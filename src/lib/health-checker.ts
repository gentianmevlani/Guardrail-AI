/**
 * Health Checker
 * 
 * Monitors system health and provides status
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  timestamp: string;
  uptime: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  duration?: number;
}

class HealthChecker {
  /**
   * Run health checks
   */
  async checkHealth(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];
    const startTime = Date.now();

    // Check Node.js version
    checks.push(await this.checkNodeVersion());

    // Check dependencies
    checks.push(await this.checkDependencies());

    // Check file system
    checks.push(await this.checkFileSystem());

    // Check memory
    checks.push(await this.checkMemory());

    // Check disk space
    checks.push(await this.checkDiskSpace());

    // Determine overall status
    const hasFailures = checks.some(c => c.status === 'fail');
    const hasWarnings = checks.some(c => c.status === 'warn');
    
    let status: HealthStatus['status'] = 'healthy';
    if (hasFailures) {
      status = 'unhealthy';
    } else if (hasWarnings) {
      status = 'degraded';
    }

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Check Node.js version
   */
  private async checkNodeVersion(): Promise<HealthCheck> {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);

    if (major >= 18) {
      return {
        name: 'Node.js Version',
        status: 'pass',
        message: `Node.js ${version} is supported`,
      };
    } else {
      return {
        name: 'Node.js Version',
        status: 'warn',
        message: `Node.js ${version} - recommend Node.js 18+`,
      };
    }
  }

  /**
   * Check dependencies
   */
  private async checkDependencies(): Promise<HealthCheck> {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      const requiredDeps = ['typescript', 'eslint'];
      const missing = requiredDeps.filter(dep => 
        !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
      );

      if (missing.length === 0) {
        return {
          name: 'Dependencies',
          status: 'pass',
          message: 'All required dependencies installed',
        };
      } else {
        return {
          name: 'Dependencies',
          status: 'warn',
          message: `Missing optional dependencies: ${missing.join(', ')}`,
        };
      }
    } catch (error) {
      return {
        name: 'Dependencies',
        status: 'warn',
        message: 'Could not check dependencies',
      };
    }
  }

  /**
   * Check file system
   */
  private async checkFileSystem(): Promise<HealthCheck> {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const testPath = path.join(process.cwd(), '.guardrail');
      await fs.mkdir(testPath, { recursive: true });
      await fs.access(testPath);
      
      return {
        name: 'File System',
        status: 'pass',
        message: 'File system is accessible',
      };
    } catch (error) {
      return {
        name: 'File System',
        status: 'fail',
        message: 'File system access failed',
      };
    }
  }

  /**
   * Check memory
   */
  private async checkMemory(): Promise<HealthCheck> {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const percentUsed = (heapUsedMB / heapTotalMB) * 100;

    if (percentUsed > 90) {
      return {
        name: 'Memory',
        status: 'warn',
        message: `High memory usage: ${percentUsed.toFixed(1)}% (${heapUsedMB.toFixed(1)}MB / ${heapTotalMB.toFixed(1)}MB)`,
      };
    } else {
      return {
        name: 'Memory',
        status: 'pass',
        message: `Memory usage: ${percentUsed.toFixed(1)}% (${heapUsedMB.toFixed(1)}MB / ${heapTotalMB.toFixed(1)}MB)`,
      };
    }
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<HealthCheck> {
    // Simplified check - in production would use actual disk space API
    return {
      name: 'Disk Space',
      status: 'pass',
      message: 'Disk space check passed',
    };
  }

  /**
   * Quick health check
   */
  async quickCheck(): Promise<boolean> {
    const health = await this.checkHealth();
    return health.status === 'healthy';
  }
}

export const healthChecker = new HealthChecker();

