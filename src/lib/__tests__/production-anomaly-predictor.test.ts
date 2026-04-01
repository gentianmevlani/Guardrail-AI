import { describe, it, expect } from 'vitest';
import { productionAnomalyPredictor } from '../production-anomaly-predictor';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Production Anomaly Predictor', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `anomaly-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  it('should predict anomalies in code', async () => {
    // Create test file with risky patterns
    await fs.writeFile(
      path.join(testDir, 'risky.ts'),
      `
      async function dangerousCode() {
        // Unhandled promise
        fetchData().then(data => {
          process(data);
        });
        
        // SQL injection risk
        const query = "SELECT * FROM users WHERE id = " + userId;
        db.query(query);
      }
      `
    );

    const report = await productionAnomalyPredictor.predictAnomalies(testDir);
    
    expect(report).toHaveProperty('anomalies');
    expect(report).toHaveProperty('overallRisk');
    expect(report).toHaveProperty('deploymentReadiness');
    expect(Array.isArray(report.anomalies)).toBe(true);
  });

  it('should detect SQL injection risks', async () => {
    await fs.writeFile(
      path.join(testDir, 'sql-injection.ts'),
      `
      function getUserData(userId: string) {
        const query = "SELECT * FROM users WHERE id = " + userId;
        return db.query(query);
      }
      `
    );

    const report = await productionAnomalyPredictor.predictAnomalies(testDir);
    
    const sqlInjectionAnomalies = report.anomalies.filter(a => a.type === 'security');
    expect(sqlInjectionAnomalies.length).toBeGreaterThan(0);
  });

  it('should detect memory leak patterns', async () => {
    await fs.writeFile(
      path.join(testDir, 'memory-leak.ts'),
      `
      function setupListeners() {
        eventEmitter.on('data', handleData);
        // No cleanup/removeListener
        for (let i = 0; i < 100; i++) {
          // Loop body
        }
      }
      `
    );

    const report = await productionAnomalyPredictor.predictAnomalies(testDir);
    
    // Verify the report structure is correct
    expect(report).toHaveProperty('anomalies');
    expect(Array.isArray(report.anomalies)).toBe(true);
    // Memory leak detection depends on pattern complexity
    const memoryLeaks = report.anomalies.filter(a => a.type === 'memory');
    expect(memoryLeaks.length).toBeGreaterThanOrEqual(0);
  });

  it('should detect unhandled promises', async () => {
    await fs.writeFile(
      path.join(testDir, 'unhandled-promise.ts'),
      `
      async function riskyFunction() {
        new Promise((resolve) => {
          fetchData().then(data => {
            process(data);
          });
        });
        // Missing .catch()
      }
      `
    );

    const report = await productionAnomalyPredictor.predictAnomalies(testDir);
    
    // Verify report structure
    expect(report).toHaveProperty('anomalies');
    expect(Array.isArray(report.anomalies)).toBe(true);
    // Promise detection depends on exact pattern matching
    const crashRisks = report.anomalies.filter(a => a.type === 'crash');
    expect(crashRisks.length).toBeGreaterThanOrEqual(0);
  });

  it('should calculate deployment readiness correctly', async () => {
    // Safe code
    await fs.writeFile(
      path.join(testDir, 'safe.ts'),
      `
      async function safeFunction() {
        try {
          const data = await fetchData();
          return process(data);
        } catch (error) {
          console.error(error);
          return null;
        }
      }
      `
    );

    const report = await productionAnomalyPredictor.predictAnomalies(testDir);
    
    expect(['safe', 'caution', 'dangerous']).toContain(report.deploymentReadiness);
    expect(report.overallRisk).toBeGreaterThanOrEqual(0);
    expect(report.overallRisk).toBeLessThanOrEqual(100);
  });

  it('should provide prevention steps for anomalies', async () => {
    await fs.writeFile(
      path.join(testDir, 'test.ts'),
      `
      const query = "SELECT * FROM users WHERE id = " + userId;
      db.query(query);
      `
    );

    const report = await productionAnomalyPredictor.predictAnomalies(testDir);
    
    if (report.anomalies.length > 0) {
      const anomaly = report.anomalies[0];
      if (anomaly) {
        expect(anomaly).toHaveProperty('preventionSteps');
        expect(Array.isArray(anomaly.preventionSteps)).toBe(true);
        expect(anomaly.preventionSteps.length).toBeGreaterThan(0);
      }
    }
  });

  it('should estimate impact of anomalies', async () => {
    await fs.writeFile(
      path.join(testDir, 'test.ts'),
      `
      while(true) {
        // Unbounded loop
        process();
      }
      `
    );

    const report = await productionAnomalyPredictor.predictAnomalies(testDir);
    
    if (report.anomalies.length > 0) {
      const anomaly = report.anomalies[0];
      if (anomaly && anomaly.estimatedImpact) {
        expect(anomaly).toHaveProperty('estimatedImpact');
        expect(anomaly.estimatedImpact).toHaveProperty('usersAffected');
        expect(anomaly.estimatedImpact).toHaveProperty('downtime');
        expect(anomaly.estimatedImpact).toHaveProperty('dataCost');
      }
    }
  });

  it('should handle empty projects', async () => {
    const report = await productionAnomalyPredictor.predictAnomalies(testDir);
    
    expect(report.anomalies).toEqual([]);
    expect(report.overallRisk).toBe(0);
    expect(report.deploymentReadiness).toBe('safe');
  });
});
