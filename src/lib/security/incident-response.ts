import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  category: IncidentCategory;
  source: {
    type: 'automated' | 'manual' | 'external';
    name: string;
    reference?: string;
  };
  timeline: IncidentEvent[];
  assignee?: string;
  tags: string[];
  metadata: { [key: string]: any };
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  estimatedResolution?: Date;
  impact: {
    affectedSystems: string[];
    affectedUsers: number;
    businessImpact: 'critical' | 'high' | 'medium' | 'low';
    financialImpact?: number;
  };
  rootCause?: RootCauseAnalysis;
  lessonsLearned?: string[];
}

export interface IncidentEvent {
  id: string;
  timestamp: Date;
  type: 'created' | 'updated' | 'assigned' | 'escalated' | 'contained' | 'resolved' | 'notified';
  description: string;
  actor: string;
  metadata?: { [key: string]: any };
}

export type IncidentCategory = 
  | 'security_breach'
  | 'data_leak'
  | 'service_outage'
  | 'performance_degradation'
  | 'vulnerability_disclosure'
  | 'compliance_violation'
  | 'infrastructure_failure'
  | 'human_error'
  | 'third_party_issue'
  | 'natural_disaster';

export interface RootCauseAnalysis {
  primaryCause: string;
  contributingFactors: string[];
  evidence: Evidence[];
  timeline: RootCauseEvent[];
  preventionMeasures: string[];
}

export interface Evidence {
  type: 'log' | 'metric' | 'screenshot' | 'network_capture' | 'configuration' | 'testimony';
  description: string;
  source: string;
  timestamp: Date;
  data: any;
}

export interface RootCauseEvent {
  timestamp: Date;
  event: string;
  impact: string;
  evidence?: string[];
}

export interface IncidentResponse {
  incidentId: string;
  actions: ResponseAction[];
  communicationPlan: CommunicationPlan;
  escalationPolicy: EscalationPolicy;
  rollbackPlan?: RollbackPlan;
}

export interface ResponseAction {
  id: string;
  type: 'containment' | 'mitigation' | 'eradication' | 'recovery' | 'prevention';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignee?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  dependencies?: string[];
  createdAt: Date;
  completedAt?: Date;
}

export interface CommunicationPlan {
  stakeholders: Stakeholder[];
  templates: { [key: string]: string };
  schedule: CommunicationSchedule[];
  channels: ('email' | 'slack' | 'sms' | 'pager' | 'dashboard')[];
}

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  contact: {
    email?: string;
    phone?: string;
    slack?: string;
  };
  notificationLevel: 'all' | 'high_severity' | 'critical_only';
  timezone?: string;
}

export interface CommunicationSchedule {
  trigger: 'immediate' | 'hourly' | 'daily' | 'resolution';
  template: string;
  recipients: string[];
}

export interface EscalationPolicy {
  rules: EscalationRule[];
  currentLevel: number;
  lastEscalated?: Date;
}

export interface EscalationRule {
  level: number;
  trigger: {
    type: 'time' | 'severity' | 'impact' | 'manual';
    condition: string;
  };
  assignee: string;
  notify: string[];
  actions: string[];
}

export interface RollbackPlan {
  steps: RollbackStep[];
  prerequisites: string[];
  risks: string[];
  estimatedTime: number;
  successCriteria: string[];
}

export interface RollbackStep {
  id: string;
  description: string;
  command?: string;
  verification?: string;
  rollbackCommand?: string;
  estimatedTime: number;
  dependencies?: string[];
}

export interface IncidentReport {
  incidentId: string;
  summary: string;
  timeline: IncidentEvent[];
  impact: Incident['impact'];
  rootCause: RootCauseAnalysis;
  responseActions: ResponseAction[];
  lessonsLearned: string[];
  recommendations: string[];
  followUpActions: string[];
  metrics: {
    mttd: number;
    mttr: number;
    totalCost: number;
    customerImpact: number;
  };
}

export class IncidentResponseSystem extends EventEmitter {
  private incidents: Map<string, Incident> = new Map();
  private responsePlans: Map<string, IncidentResponse> = new Map();
  private activeIncidents: Set<string> = new Set();
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();
  private communicationTemplates: Map<string, string> = new Map();

  constructor() {
    super();
    this.initializeTemplates();
    this.initializeDefaultPolicies();
  }

  async createIncident(incident: Omit<Incident, 'id' | 'createdAt' | 'updatedAt' | 'timeline'>): Promise<string> {
    const id = this.generateIncidentId();
    const now = new Date();

    const fullIncident: Incident = {
      ...incident,
      id,
      createdAt: now,
      updatedAt: now,
      timeline: [{
        id: this.generateEventId(),
        timestamp: now,
        type: 'created',
        description: `Incident created: ${incident.title}`,
        actor: 'system',
      }],
    };

    this.incidents.set(id, fullIncident);
    this.activeIncidents.add(id);

    const responsePlan = await this.createResponsePlan(id, incident.severity);
    this.responsePlans.set(id, responsePlan);

    this.emit('incident-created', fullIncident);

    if (incident.severity === 'critical' || incident.severity === 'high') {
      await this.executeEscalation(id);
    }

    await this.sendInitialNotification(id);

    return id;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<void> {
    const incident = this.incidents.get(id);
    if (!incident) {
      throw new Error(`Incident with id ${id} not found`);
    }

    const previousStatus = incident.status;
    Object.assign(incident, updates, { updatedAt: new Date() });

    if (updates.status && updates.status !== previousStatus) {
      incident.timeline.push({
        id: this.generateEventId(),
        timestamp: new Date(),
        type: 'updated',
        description: `Status changed from ${previousStatus} to ${updates.status}`,
        actor: 'system',
      });

      if (updates.status === 'resolved') {
        incident.resolvedAt = new Date();
        this.activeIncidents.delete(id);
        await this.sendResolutionNotification(id);
      }
    }

    this.incidents.set(id, incident);
    this.emit('incident-updated', incident);
  }

  async assignIncident(id: string, assignee: string): Promise<void> {
    await this.updateIncident(id, { assignee });

    const incident = this.incidents.get(id)!;
    incident.timeline.push({
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'assigned',
      description: `Incident assigned to ${assignee}`,
      actor: 'system',
    });

    this.emit('incident-assigned', { incidentId: id, assignee });
  }

  async addEvent(id: string, event: Omit<IncidentEvent, 'id' | 'timestamp'>): Promise<void> {
    const incident = this.incidents.get(id);
    if (!incident) {
      throw new Error(`Incident with id ${id} not found`);
    }

    const fullEvent: IncidentEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
    };

    incident.timeline.push(fullEvent);
    incident.updatedAt = new Date();

    this.emit('event-added', { incidentId: id, event: fullEvent });
  }

  async executeResponseAction(incidentId: string, actionId: string): Promise<void> {
    const responsePlan = this.responsePlans.get(incidentId);
    if (!responsePlan) {
      throw new Error(`No response plan found for incident ${incidentId}`);
    }

    const action = responsePlan.actions.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found in response plan`);
    }

    action.status = 'in_progress';
    this.emit('action-started', { incidentId, actionId });

    try {
      await this.executeAction(action);
      action.status = 'completed';
      action.completedAt = new Date();
      this.emit('action-completed', { incidentId, actionId });
    } catch (error) {
      action.status = 'failed';
      this.emit('action-failed', { incidentId, actionId, error });
    }
  }

  async executeEscalation(incidentId: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    const policy = this.escalationPolicies.get(incident.severity);
    if (!policy) return;

    const currentRule = policy.rules.find(r => r.level === policy.currentLevel + 1);
    if (!currentRule) return;

    if (this.shouldEscalate(incident, currentRule)) {
      await this.assignIncident(incidentId, currentRule.assignee);
      
      for (const notifyId of currentRule.notify) {
        await this.sendEscalationNotification(incidentId, notifyId, currentRule.level);
      }

      policy.currentLevel++;
      policy.lastEscalated = new Date();

      incident.timeline.push({
        id: this.generateEventId(),
        timestamp: new Date(),
        type: 'escalated',
        description: `Escalated to level ${currentRule.level} - ${currentRule.assignee}`,
        actor: 'system',
      });

      this.emit('incident-escalated', { incidentId, level: currentRule.level });
    }
  }

  async containIncident(incidentId: string): Promise<void> {
    const responsePlan = this.responsePlans.get(incidentId);
    if (!responsePlan) return;

    const containmentActions = responsePlan.actions.filter(a => a.type === 'containment');
    
    for (const action of containmentActions) {
      if (action.status === 'pending') {
        await this.executeResponseAction(incidentId, action.id);
      }
    }

    await this.updateIncident(incidentId, { status: 'contained' });
  }

  async resolveIncident(incidentId: string, resolution: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    await this.addEvent(incidentId, {
      type: 'resolved',
      description: `Incident resolved: ${resolution}`,
      actor: 'system',
    });

    await this.updateIncident(incidentId, { 
      status: 'resolved',
      lessonsLearned: [...(incident.lessonsLearned || []), resolution],
    });

    await this.generatePostMortem(incidentId);
  }

  async generatePostMortem(incidentId: string): Promise<IncidentReport> {
    const incident = this.incidents.get(incidentId);
    const responsePlan = this.responsePlans.get(incidentId);
    
    if (!incident || !responsePlan) {
      throw new Error(`Incident ${incidentId} not found or no response plan available`);
    }

    const mttd = this.calculateMTTD(incident);
    const mttr = this.calculateMTTR(incident);

    const report: IncidentReport = {
      incidentId,
      summary: incident.description,
      timeline: incident.timeline,
      impact: incident.impact,
      rootCause: incident.rootCause || {
        primaryCause: 'Under investigation',
        contributingFactors: [],
        evidence: [],
        timeline: [],
        preventionMeasures: [],
      },
      responseActions: responsePlan.actions,
      lessonsLearned: incident.lessonsLearned || [],
      recommendations: this.generateRecommendations(incident),
      followUpActions: this.generateFollowUpActions(incident),
      metrics: {
        mttd,
        mttr,
        totalCost: this.calculateIncidentCost(incident),
        customerImpact: incident.impact.affectedUsers,
      },
    };

    this.emit('post-mortem-generated', { incidentId, report });
    return report;
  }

  async createResponsePlan(incidentId: string, severity: Incident['severity']): Promise<IncidentResponse> {
    const actions = await this.generateResponseActions(severity);
    
    return {
      incidentId,
      actions,
      communicationPlan: {
        stakeholders: [],
        templates: {},
        schedule: [],
        channels: ['email', 'slack'],
      },
      escalationPolicy: this.escalationPolicies.get(severity) || {
        rules: [],
        currentLevel: 0,
      },
    };
  }

  private async generateResponseActions(severity: Incident['severity']): Promise<ResponseAction[]> {
    const actions: ResponseAction[] = [];

    actions.push({
      id: this.generateActionId(),
      type: 'containment',
      description: 'Isolate affected systems',
      status: 'pending',
      createdAt: new Date(),
      estimatedDuration: 300,
    });

    actions.push({
      id: this.generateActionId(),
      type: 'mitigation',
      description: 'Implement temporary fixes',
      status: 'pending',
      createdAt: new Date(),
      estimatedDuration: 600,
    });

    if (severity === 'critical' || severity === 'high') {
      actions.push({
        id: this.generateActionId(),
        type: 'communication',
        description: 'Notify stakeholders',
        status: 'pending',
        createdAt: new Date(),
        estimatedDuration: 60,
      });
    }

    return actions;
  }

  private async executeAction(action: ResponseAction): Promise<void> {
    switch (action.type) {
      case 'containment':
        await this.executeContainment(action);
        break;
      case 'mitigation':
        await this.executeMitigation(action);
        break;
      case 'eradication':
        await this.executeEradication(action);
        break;
      case 'recovery':
        await this.executeRecovery(action);
        break;
      case 'prevention':
        await this.executePrevention(action);
        break;
    }
  }

  private async executeContainment(action: ResponseAction): Promise<void> {
    console.log(`Executing containment: ${action.description}`);
  }

  private async executeMitigation(action: ResponseAction): Promise<void> {
    console.log(`Executing mitigation: ${action.description}`);
  }

  private async executeEradication(action: ResponseAction): Promise<void> {
    console.log(`Executing eradication: ${action.description}`);
  }

  private async executeRecovery(action: ResponseAction): Promise<void> {
    console.log(`Executing recovery: ${action.description}`);
  }

  private async executePrevention(action: ResponseAction): Promise<void> {
    console.log(`Executing prevention: ${action.description}`);
  }

  private shouldEscalate(incident: Incident, rule: EscalationRule): boolean {
    switch (rule.trigger.type) {
      case 'time':
        const timeSinceCreation = Date.now() - incident.createdAt.getTime();
        return timeSinceCreation > parseInt(rule.trigger.condition);
      case 'severity':
        return incident.severity === rule.trigger.condition;
      case 'impact':
        return incident.impact.businessImpact === rule.trigger.condition;
      case 'manual':
        return false;
      default:
        return false;
    }
  }

  private async sendInitialNotification(incidentId: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    const template = this.communicationTemplates.get('initial') || 'Incident {title} has been created';
    const message = template.replace('{title}', incident.title);

    this.emit('notification-sent', { incidentId, type: 'initial', message });
  }

  private async sendEscalationNotification(incidentId: string, recipient: string, level: number): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    const template = this.communicationTemplates.get('escalation') || 'Incident {title} has been escalated to level {level}';
    const message = template.replace('{title}', incident.title).replace('{level}', level.toString());

    this.emit('notification-sent', { incidentId, recipient, type: 'escalation', message });
  }

  private async sendResolutionNotification(incidentId: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    const template = this.communicationTemplates.get('resolution') || 'Incident {title} has been resolved';
    const message = template.replace('{title}', incident.title);

    this.emit('notification-sent', { incidentId, type: 'resolution', message });
  }

  private calculateMTTD(incident: Incident): number {
    const createdEvent = incident.timeline.find(e => e.type === 'created');
    const investigatingEvent = incident.timeline.find(e => e.type === 'updated' && e.description.includes('investigating'));
    
    if (!createdEvent || !investigatingEvent) return 0;
    
    return investigatingEvent.timestamp.getTime() - createdEvent.timestamp.getTime();
  }

  private calculateMTTR(incident: Incident): number {
    if (!incident.resolvedAt) return 0;
    return incident.resolvedAt.getTime() - incident.createdAt.getTime();
  }

  private calculateIncidentCost(incident: Incident): number {
    const hoursDown = incident.resolvedAt ? 
      (incident.resolvedAt.getTime() - incident.createdAt.getTime()) / (1000 * 60 * 60) : 0;
    
    const hourlyCost = incident.impact.businessImpact === 'critical' ? 10000 :
                      incident.impact.businessImpact === 'high' ? 5000 :
                      incident.impact.businessImpact === 'medium' ? 1000 : 100;
    
    return hoursDown * hourlyCost;
  }

  private generateRecommendations(incident: Incident): string[] {
    const recommendations: string[] = [];

    if (incident.category === 'security_breach') {
      recommendations.push('Review and enhance security controls');
      recommendations.push('Conduct security awareness training');
    }

    if (incident.category === 'service_outage') {
      recommendations.push('Implement redundancy for critical services');
      recommendations.push('Review monitoring and alerting thresholds');
    }

    recommendations.push('Update incident response procedures');
    recommendations.push('Schedule follow-up review in 30 days');

    return recommendations;
  }

  private generateFollowUpActions(incident: Incident): string[] {
    return [
      'Schedule post-mortem review meeting',
      'Update documentation',
      'Implement preventive measures',
      'Monitor for recurrence',
    ];
  }

  private initializeTemplates(): void {
    this.communicationTemplates.set('initial', '🚨 Incident Alert: {title}\n\nSeverity: {severity}\nDescription: {description}');
    this.communicationTemplates.set('escalation', '⬆️ Incident Escalated: {title}\n\nEscalated to level {level}\nAssignee: {assignee}');
    this.communicationTemplates.set('resolution', '✅ Incident Resolved: {title}\n\nResolution time: {resolutionTime}\nNext steps: {nextSteps}');
    this.communicationTemplates.set('update', '📋 Incident Update: {title}\n\nStatus: {status}\nLatest: {update}');
  }

  private initializeDefaultPolicies(): void {
    const criticalPolicy: EscalationPolicy = {
      rules: [
        {
          level: 1,
          trigger: { type: 'time', condition: '900000' },
          assignee: 'incident-commander',
          notify: ['security-team', 'management'],
          actions: ['mobilize-response-team'],
        },
        {
          level: 2,
          trigger: { type: 'time', condition: '1800000' },
          assignee: 'executive-sponsor',
          notify: ['all-staff', 'customers'],
          actions: ['activate-war-room'],
        },
      ],
      currentLevel: 0,
    };

    this.escalationPolicies.set('critical', criticalPolicy);
    this.escalationPolicies.set('high', { ...criticalPolicy, currentLevel: 0 });
  }

  private generateIncidentId(): string {
    return `INC-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private generateEventId(): string {
    return randomBytes(8).toString('hex');
  }

  private generateActionId(): string {
    return `ACT-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  async getIncidentDashboard(): Promise<{
    activeIncidents: Incident[];
    recentIncidents: Incident[];
    metrics: {
      totalIncidents: number;
      mttr: number;
      mttd: number;
      openIncidents: number;
      criticalIncidents: number;
    };
    trends: {
      daily: { date: string; count: number }[];
      byCategory: { category: string; count: number }[];
      bySeverity: { severity: string; count: number }[];
    };
  }> {
    const activeIncidents = Array.from(this.activeIncidents)
      .map(id => this.incidents.get(id)!);
    
    const recentIncidents = Array.from(this.incidents.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20);

    const resolvedIncidents = Array.from(this.incidents.values())
      .filter(i => i.status === 'resolved');
    
    const mttr = resolvedIncidents.length > 0 ?
      resolvedIncidents.reduce((sum, i) => sum + this.calculateMTTR(i), 0) / resolvedIncidents.length : 0;
    
    const mttd = resolvedIncidents.length > 0 ?
      resolvedIncidents.reduce((sum, i) => sum + this.calculateMTTD(i), 0) / resolvedIncidents.length : 0;

    return {
      activeIncidents,
      recentIncidents,
      metrics: {
        totalIncidents: this.incidents.size,
        mttr,
        mttd,
        openIncidents: this.activeIncidents.size,
        criticalIncidents: activeIncidents.filter(i => i.severity === 'critical').length,
      },
      trends: {
        daily: this.calculateDailyTrends(),
        byCategory: this.calculateCategoryTrends(),
        bySeverity: this.calculateSeverityTrends(),
      },
    };
  }

  private calculateDailyTrends(): { date: string; count: number }[] {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    return last30Days.map(date => ({
      date,
      count: Array.from(this.incidents.values())
        .filter(i => i.createdAt.toISOString().split('T')[0] === date).length,
    }));
  }

  private calculateCategoryTrends(): { category: string; count: number }[] {
    const categories: { [key: string]: number } = {};
    
    this.incidents.forEach(incident => {
      categories[incident.category] = (categories[incident.category] || 0) + 1;
    });

    return Object.entries(categories)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateSeverityTrends(): { severity: string; count: number }[] {
    const severities: { [key: string]: number } = {};
    
    this.incidents.forEach(incident => {
      severities[incident.severity] = (severities[incident.severity] || 0) + 1;
    });

    return Object.entries(severities)
      .map(([severity, count]) => ({ severity, count }))
      .sort((a, b) => b.count - a.count);
  }
}

export const incidentResponse = new IncidentResponseSystem();
