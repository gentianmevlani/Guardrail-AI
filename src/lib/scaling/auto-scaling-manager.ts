import { CloudWatchClient, PutMetricDataCommand, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { AutoScalingClient, SetDesiredCapacityCommand, UpdateAutoScalingGroupCommand, DescribeAutoScalingGroupsCommand } from '@aws-sdk/client-auto-scaling';
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { EventEmitter } from 'events';

export interface ScalingPolicy {
  name: string;
  metricName: string;
  namespace: string;
  statistic: 'Average' | 'Sum' | 'Minimum' | 'Maximum';
  period: number;
  evaluationPeriods: number;
  threshold: number;
  comparisonOperator: 'GreaterThanOrEqualToThreshold' | 'GreaterThanThreshold' | 'LessThanThreshold' | 'LessThanOrEqualToThreshold';
  scalingAdjustment: number;
  adjustmentType: 'ChangeInCapacity' | 'ExactCapacity' | 'PercentChangeInCapacity';
  cooldown: number;
  minAdjustmentMagnitude?: number;
}

export interface AutoScalingGroupConfig {
  name: string;
  launchTemplate: string;
  minSize: number;
  maxSize: number;
  desiredCapacity: number;
  availabilityZones: string[];
  healthCheckType: 'EC2' | 'ELB';
  healthCheckGracePeriod: number;
  targetGroups?: string[];
  vpcZoneIdentifier?: string;
  tags?: { Key: string; Value: string; PropagateAtLaunch: boolean }[];
}

export interface ScalingMetrics {
  cpuUtilization: number;
  memoryUtilization: number;
  requestCount: number;
  latency: number;
  errorRate: number;
  activeConnections: number;
  queueDepth: number;
}

export interface ScalingEvent {
  type: 'scale_out' | 'scale_in';
  reason: string;
  metricValue: number;
  threshold: number;
  timestamp: Date;
  desiredCapacity: number;
  currentCapacity: number;
}

export class AutoScalingManager extends EventEmitter {
  private cloudwatch: CloudWatchClient;
  private autoscaling: AutoScalingClient;
  private ec2: EC2Client;
  private scalingPolicies: Map<string, ScalingPolicy> = new Map();
  private metricsHistory: ScalingMetrics[] = [];
  private scalingHistory: ScalingEvent[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(awsConfig?: any) {
    super();
    this.cloudwatch = new CloudWatchClient({
      region: process.env.AWS_REGION || 'us-east-1',
      ...awsConfig,
    });
    this.autoscaling = new AutoScalingClient({
      region: process.env.AWS_REGION || 'us-east-1',
      ...awsConfig,
    });
    this.ec2 = new EC2Client({
      region: process.env.AWS_REGION || 'us-east-1',
      ...awsConfig,
    });
  }

  async createAutoScalingGroup(config: AutoScalingGroupConfig): Promise<void> {
    const command = new UpdateAutoScalingGroupCommand({
      AutoScalingGroupName: config.name,
      LaunchTemplate: { LaunchTemplateId: config.launchTemplate },
      MinSize: config.minSize,
      MaxSize: config.maxSize,
      DesiredCapacity: config.desiredCapacity,
      AvailabilityZones: config.availabilityZones,
      HealthCheckType: config.healthCheckType,
      HealthCheckGracePeriod: config.healthCheckGracePeriod,
      TargetGroupARNs: config.targetGroups,
      VPCZoneIdentifier: config.vpcZoneIdentifier,
      Tags: config.tags,
    });

    await this.autoscaling.send(command);
    console.log(`Auto Scaling Group '${config.name}' created/updated`);
  }

  addScalingPolicy(policy: ScalingPolicy): void {
    this.scalingPolicies.set(policy.name, policy);
    console.log(`Scaling policy '${policy.name}' added`);
  }

  async startMonitoring(groupName: string, intervalSeconds: number = 60): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics(groupName);
        await this.evaluateScalingPolicies(groupName, metrics);
        this.emit('metrics-collected', metrics);
      } catch (error) {
        console.error('Error during monitoring cycle:', error);
        this.emit('monitoring-error', error);
      }
    }, intervalSeconds * 1000);

    console.log(`Started monitoring Auto Scaling Group '${groupName}'`);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Stopped monitoring');
    }
  }

  private async collectMetrics(groupName: string): Promise<ScalingMetrics> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 5 * 60 * 1000);

    const [cpuUtilization, memoryUtilization, requestCount, latency, errorRate] = await Promise.all([
      this.getMetric('AWS/EC2', 'CPUUtilization', groupName, startTime, endTime),
      this.getMetric('System/Linux', 'MemoryUtilization', groupName, startTime, endTime),
      this.getMetric('AWS/ApplicationELB', 'RequestCount', groupName, startTime, endTime),
      this.getMetric('AWS/ApplicationELB', 'TargetResponseTime', groupName, startTime, endTime),
      this.getMetric('AWS/ApplicationELB', 'HTTPCode_Target_5XX_Count', groupName, startTime, endTime),
    ]);

    const metrics: ScalingMetrics = {
      cpuUtilization,
      memoryUtilization,
      requestCount,
      latency,
      errorRate,
      activeConnections: await this.getActiveConnections(groupName),
      queueDepth: await this.getQueueDepth(groupName),
    };

    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-500);
    }

    return metrics;
  }

  private async getMetric(
    namespace: string,
    metricName: string,
    groupName: string,
    startTime: Date,
    endTime: Date
  ): Promise<number> {
    try {
      const command = new GetMetricStatisticsCommand({
        Namespace: namespace,
        MetricName: metricName,
        Dimensions: [
          {
            Name: 'AutoScalingGroupName',
            Value: groupName,
          },
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 60,
        Statistics: ['Average'],
      });

      const response = await this.cloudwatch.send(command);
      const datapoints = response.Datapoints || [];
      
      if (datapoints.length === 0) {
        return 0;
      }

      return datapoints[datapoints.length - 1].Average || 0;
    } catch (error) {
      console.error(`Error getting metric ${metricName}:`, error);
      return 0;
    }
  }

  private async getActiveConnections(groupName: string): Promise<number> {
    return 0;
  }

  private async getQueueDepth(groupName: string): Promise<number> {
    return 0;
  }

  private async evaluateScalingPolicies(groupName: string, metrics: ScalingMetrics): Promise<void> {
    const currentCapacity = await this.getCurrentCapacity(groupName);
    
    for (const [name, policy] of this.scalingPolicies) {
      const metricValue = this.getMetricValue(metrics, policy.metricName);
      
      if (metricValue === undefined) {
        continue;
      }

      const shouldScale = this.evaluateCondition(metricValue, policy.threshold, policy.comparisonOperator);
      
      if (shouldScale) {
        const newCapacity = this.calculateNewCapacity(currentCapacity, policy);
        
        if (newCapacity !== currentCapacity) {
          await this.executeScaling(groupName, newCapacity, policy, metricValue);
        }
      }
    }
  }

  private getMetricValue(metrics: ScalingMetrics, metricName: string): number | undefined {
    switch (metricName) {
      case 'CPUUtilization':
        return metrics.cpuUtilization;
      case 'MemoryUtilization':
        return metrics.memoryUtilization;
      case 'RequestCount':
        return metrics.requestCount;
      case 'Latency':
        return metrics.latency;
      case 'ErrorRate':
        return metrics.errorRate;
      case 'ActiveConnections':
        return metrics.activeConnections;
      case 'QueueDepth':
        return metrics.queueDepth;
      default:
        return undefined;
    }
  }

  private evaluateCondition(
    value: number,
    threshold: number,
    operator: ScalingPolicy['comparisonOperator']
  ): boolean {
    switch (operator) {
      case 'GreaterThanOrEqualToThreshold':
        return value >= threshold;
      case 'GreaterThanThreshold':
        return value > threshold;
      case 'LessThanThreshold':
        return value < threshold;
      case 'LessThanOrEqualToThreshold':
        return value <= threshold;
      default:
        return false;
    }
  }

  private calculateNewCapacity(currentCapacity: number, policy: ScalingPolicy): number {
    let newCapacity: number;

    switch (policy.adjustmentType) {
      case 'ChangeInCapacity':
        newCapacity = currentCapacity + policy.scalingAdjustment;
        break;
      case 'ExactCapacity':
        newCapacity = policy.scalingAdjustment;
        break;
      case 'PercentChangeInCapacity':
        const adjustment = Math.round(currentCapacity * (policy.scalingAdjustment / 100));
        newCapacity = currentCapacity + adjustment;
        if (policy.minAdjustmentMagnitude && Math.abs(adjustment) < policy.minAdjustmentMagnitude) {
          newCapacity = currentCapacity + (adjustment > 0 ? policy.minAdjustmentMagnitude : -policy.minAdjustmentMagnitude);
        }
        break;
      default:
        return currentCapacity;
    }

    return newCapacity;
  }

  private async executeScaling(
    groupName: string,
    newCapacity: number,
    policy: ScalingPolicy,
    metricValue: number
  ): Promise<void> {
    try {
      const command = new SetDesiredCapacityCommand({
        AutoScalingGroupName: groupName,
        DesiredCapacity: newCapacity,
        HonorCooldown: false,
      });

      await this.autoscaling.send(command);

      const event: ScalingEvent = {
        type: newCapacity > (await this.getCurrentCapacity(groupName)) ? 'scale_out' : 'scale_in',
        reason: `Policy '${policy.name}' triggered. ${policy.metricName} = ${metricValue} (threshold: ${policy.threshold})`,
        metricValue,
        threshold: policy.threshold,
        timestamp: new Date(),
        desiredCapacity: newCapacity,
        currentCapacity: await this.getCurrentCapacity(groupName),
      };

      this.scalingHistory.push(event);
      this.emit('scaling-event', event);

      console.log(`Scaling ${event.type} executed for group '${groupName}'. New capacity: ${newCapacity}`);
    } catch (error) {
      console.error('Error executing scaling:', error);
      this.emit('scaling-error', error);
    }
  }

  private async getCurrentCapacity(groupName: string): Promise<number> {
    try {
      const command = new DescribeAutoScalingGroupsCommand({
        AutoScalingGroupNames: [groupName],
      });

      const response = await this.autoscaling.send(command);
      const group = response.AutoScalingGroups?.[0];
      
      return group?.Instances?.length || 0;
    } catch (error) {
      console.error('Error getting current capacity:', error);
      return 0;
    }
  }

  async predictiveScaling(groupName: string): Promise<void> {
    const historicalData = this.metricsHistory.slice(-48);
    
    if (historicalData.length < 24) {
      console.log('Insufficient historical data for predictive scaling');
      return;
    }

    const prediction = this.predictNextHourLoad(historicalData);
    const recommendedCapacity = this.calculateRecommendedCapacity(prediction, groupName);
    
    console.log(`Predictive scaling recommendation for '${groupName}': ${recommendedCapacity} instances`);
    
    if (recommendedCapacity !== await this.getCurrentCapacity(groupName)) {
      await this.executeScaling(groupName, recommendedCapacity, {
        name: 'predictive-scaling',
        metricName: 'PredictedLoad',
        namespace: 'Custom',
        statistic: 'Average',
        period: 3600,
        evaluationPeriods: 1,
        threshold: 80,
        comparisonOperator: 'GreaterThanThreshold',
        scalingAdjustment: recommendedCapacity,
        adjustmentType: 'ExactCapacity',
        cooldown: 1800,
      }, 85);
    }
  }

  private predictNextHourLoad(historicalData: ScalingMetrics[]): ScalingMetrics {
    const weights = historicalData.map((_, index) => (index + 1) / historicalData.length);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    const prediction: ScalingMetrics = {
      cpuUtilization: this.weightedAverage(historicalData.map(d => d.cpuUtilization), weights, totalWeight),
      memoryUtilization: this.weightedAverage(historicalData.map(d => d.memoryUtilization), weights, totalWeight),
      requestCount: this.weightedAverage(historicalData.map(d => d.requestCount), weights, totalWeight),
      latency: this.weightedAverage(historicalData.map(d => d.latency), weights, totalWeight),
      errorRate: this.weightedAverage(historicalData.map(d => d.errorRate), weights, totalWeight),
      activeConnections: this.weightedAverage(historicalData.map(d => d.activeConnections), weights, totalWeight),
      queueDepth: this.weightedAverage(historicalData.map(d => d.queueDepth), weights, totalWeight),
    };

    const trendMultiplier = this.calculateTrendMultiplier(historicalData);
    
    return {
      cpuUtilization: Math.min(100, prediction.cpuUtilization * trendMultiplier),
      memoryUtilization: Math.min(100, prediction.memoryUtilization * trendMultiplier),
      requestCount: prediction.requestCount * trendMultiplier,
      latency: prediction.latency * trendMultiplier,
      errorRate: prediction.errorRate * trendMultiplier,
      activeConnections: prediction.activeConnections * trendMultiplier,
      queueDepth: prediction.queueDepth * trendMultiplier,
    };
  }

  private weightedAverage(values: number[], weights: number[], totalWeight: number): number {
    return values.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight;
  }

  private calculateTrendMultiplier(historicalData: ScalingMetrics[]): number {
    if (historicalData.length < 2) return 1;

    const recent = historicalData.slice(-12);
    const older = historicalData.slice(-24, -12);

    const recentAvg = recent.reduce((sum, d) => sum + d.cpuUtilization, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.cpuUtilization, 0) / older.length;

    return olderAvg > 0 ? recentAvg / olderAvg : 1;
  }

  private calculateRecommendedCapacity(prediction: ScalingMetrics, groupName: string): Promise<number> {
    return this.getCurrentCapacity(groupName);
  }

  async getScalingReport(groupName: string): Promise<{
    currentCapacity: number;
    desiredCapacity: number;
    minSize: number;
    maxSize: number;
    scalingEvents: ScalingEvent[];
    averageMetrics: ScalingMetrics;
    recommendations: string[];
  }> {
    const currentCapacity = await this.getCurrentCapacity(groupName);
    const recentMetrics = this.metricsHistory.slice(-60);
    const averageMetrics = this.calculateAverageMetrics(recentMetrics);
    const recommendations = this.generateRecommendations(averageMetrics, currentCapacity);

    return {
      currentCapacity,
      desiredCapacity: currentCapacity,
      minSize: 1,
      maxSize: 10,
      scalingEvents: this.scalingHistory.slice(-20),
      averageMetrics,
      recommendations,
    };
  }

  private calculateAverageMetrics(metrics: ScalingMetrics[]): ScalingMetrics {
    if (metrics.length === 0) {
      return {
        cpuUtilization: 0,
        memoryUtilization: 0,
        requestCount: 0,
        latency: 0,
        errorRate: 0,
        activeConnections: 0,
        queueDepth: 0,
      };
    }

    return {
      cpuUtilization: metrics.reduce((sum, m) => sum + m.cpuUtilization, 0) / metrics.length,
      memoryUtilization: metrics.reduce((sum, m) => sum + m.memoryUtilization, 0) / metrics.length,
      requestCount: metrics.reduce((sum, m) => sum + m.requestCount, 0) / metrics.length,
      latency: metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length,
      errorRate: metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length,
      activeConnections: metrics.reduce((sum, m) => sum + m.activeConnections, 0) / metrics.length,
      queueDepth: metrics.reduce((sum, m) => sum + m.queueDepth, 0) / metrics.length,
    };
  }

  private generateRecommendations(metrics: ScalingMetrics, currentCapacity: number): string[] {
    const recommendations: string[] = [];

    if (metrics.cpuUtilization > 80) {
      recommendations.push('High CPU utilization detected. Consider scaling out or optimizing workload.');
    }

    if (metrics.memoryUtilization > 85) {
      recommendations.push('High memory utilization detected. Consider scaling out or optimizing memory usage.');
    }

    if (metrics.latency > 1000) {
      recommendations.push('High latency detected. Consider scaling out or optimizing application performance.');
    }

    if (metrics.errorRate > 5) {
      recommendations.push('High error rate detected. Investigate application health before scaling.');
    }

    if (currentCapacity > 1 && metrics.cpuUtilization < 20) {
      recommendations.push('Low utilization detected. Consider scaling in to reduce costs.');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is operating within optimal parameters.');
    }

    return recommendations;
  }
}

export const autoScalingManager = new AutoScalingManager();
