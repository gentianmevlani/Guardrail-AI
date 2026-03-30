/**
 * Code Smell Predictor Tests
 */

import { codeSmellPredictor, CodeSmell, TechnicalDebtReport } from '../code-smell-predictor';
import * as fs from 'fs';
import * as path from 'path';

describe('CodeSmellPredictor', () => {
  const testDir = path.join(__dirname, 'test-code');
  
  beforeEach(async () => {
    // Create test directory with sample files
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Create a file with a long method
    const longMethodFile = `
export function veryLongFunction() {
  // This is a very long function with many lines
  console.log('line 1');
  console.log('line 2');
  console.log('line 3');
  console.log('line 4');
  console.log('line 5');
  console.log('line 6');
  console.log('line 7');
  console.log('line 8');
  console.log('line 9');
  console.log('line 10');
  console.log('line 11');
  console.log('line 12');
  console.log('line 13');
  console.log('line 14');
  console.log('line 15');
  console.log('line 16');
  console.log('line 17');
  console.log('line 18');
  console.log('line 19');
  console.log('line 20');
  console.log('line 21');
  console.log('line 22');
  console.log('line 23');
  console.log('line 24');
  console.log('line 25');
  console.log('line 26');
  console.log('line 27');
  console.log('line 28');
  console.log('line 29');
  console.log('line 30');
  console.log('line 31');
  console.log('line 32');
  console.log('line 33');
  console.log('line 34');
  console.log('line 35');
  console.log('line 36');
  console.log('line 37');
  console.log('line 38');
  console.log('line 39');
  console.log('line 40');
  console.log('line 41');
  console.log('line 42');
  console.log('line 43');
  console.log('line 44');
  console.log('line 45');
  console.log('line 46');
  console.log('line 47');
  console.log('line 48');
  console.log('line 49');
  console.log('line 50');
  console.log('line 51');
  console.log('line 52');
  console.log('line 53');
  console.log('line 54');
  console.log('line 55');
  return 'done';
}
`;
    
    // Create a file with a large class
    const largeClassFile = `
export class VeryLargeClass {
  method1() { return 1; }
  method2() { return 2; }
  method3() { return 3; }
  method4() { return 4; }
  method5() { return 5; }
  method6() { return 6; }
  method7() { return 7; }
  method8() { return 8; }
  method9() { return 9; }
  method10() { return 10; }
  method11() { return 11; }
  method12() { return 12; }
  method13() { return 13; }
  method14() { return 14; }
  method15() { return 15; }
  method16() { return 16; }
  method17() { return 17; }
  method18() { return 18; }
  method19() { return 19; }
  method20() { return 20; }
  method21() { return 21; }
  method22() { return 22; }
  method23() { return 23; }
  method24() { return 24; }
  method25() { return 25; }
  method26() { return 26; }
  method27() { return 27; }
  method28() { return 28; }
  method29() { return 29; }
  method30() { return 30; }
  method31() { return 31; }
  method32() { return 32; }
  method33() { return 33; }
  method34() { return 34; }
  method35() { return 35; }
  method36() { return 36; }
  method37() { return 37; }
  method38() { return 38; }
  method39() { return 39; }
  method40() { return 40; }
  // Many more lines to make it exceed 300 lines
  ${Array.from({length: 300}, (_, i) => `  method${i + 41}() { return ${i + 41}; }`).join('\n')}
}
`;
    
    // Create a clean file
    const cleanFile = `
export function shortFunction() {
  return 'This is a short function';
}

export class SmallClass {
  method1() { return 'method1'; }
  method2() { return 'method2'; }
}
`;
    
    fs.writeFileSync(path.join(testDir, 'long-method.ts'), longMethodFile);
    fs.writeFileSync(path.join(testDir, 'large-class.ts'), largeClassFile);
    fs.writeFileSync(path.join(testDir, 'clean.ts'), cleanFile);
  });
  
  afterEach(async () => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('predict', () => {
    it('should detect code smells and return technical debt report', async () => {
      const report = await codeSmellPredictor.predict(testDir);
      
      expect(report).toBeDefined();
      expect(report.totalSmells).toBeGreaterThan(0);
      expect(report.critical).toBeGreaterThanOrEqual(0);
      expect(report.estimatedDebt).toBeGreaterThan(0);
      expect(report.smells).toBeInstanceOf(Array);
      expect(report.trends).toBeInstanceOf(Array);
    });
    
    it('should detect long methods', async () => {
      const report = await codeSmellPredictor.predict(testDir);
      
      const longMethodSmells = report.smells.filter(smell => smell.type === 'long-method');
      expect(longMethodSmells.length).toBeGreaterThan(0);
      
      const longMethodSmell = longMethodSmells[0];
      expect(longMethodSmell.type).toBe('long-method');
      expect(longMethodSmell.severity).toMatch(/^(critical|high|medium|low)$/);
      expect(longMethodSmell.file).toContain('long-method.ts');
      expect(longMethodSmell.metrics.current).toBeGreaterThan(50);
      expect(longMethodSmell.metrics.threshold).toBe(50);
      expect(longMethodSmell.prediction.when).toMatch(/^(immediate|1-month|3-months|6-months)$/);
      expect(longMethodSmell.prediction.cost).toMatch(/^(low|medium|high)$/);
      expect(longMethodSmell.recommendation).toBeInstanceOf(Array);
      expect(longMethodSmell.recommendation.length).toBeGreaterThan(0);
    });
    
    it('should detect large classes', async () => {
      const report = await codeSmellPredictor.predict(testDir);
      
      const largeClassSmells = report.smells.filter(smell => smell.type === 'large-class');
      expect(largeClassSmells.length).toBeGreaterThan(0);
      
      const largeClassSmell = largeClassSmells[0];
      expect(largeClassSmell.type).toBe('large-class');
      expect(largeClassSmell.severity).toMatch(/^(critical|high|medium|low)$/);
      expect(largeClassSmell.file).toContain('large-class.ts');
      expect(largeClassSmell.metrics.current).toBeGreaterThan(300);
      expect(largeClassSmell.metrics.threshold).toBe(300);
      expect(largeClassSmell.prediction.when).toMatch(/^(immediate|1-month|3-months|6-months)$/);
      expect(largeClassSmell.prediction.cost).toMatch(/^(low|medium|high)$/);
      expect(largeClassSmell.recommendation).toBeInstanceOf(Array);
      expect(largeClassSmell.recommendation.length).toBeGreaterThan(0);
    });
    
    it('should calculate technical debt correctly', async () => {
      const report = await codeSmellPredictor.predict(testDir);
      
      // Check that debt calculation is reasonable
      expect(report.estimatedDebt).toBeGreaterThan(0);
      expect(typeof report.estimatedDebt).toBe('number');
      
      // Verify debt calculation based on severity
      const calculatedDebt = report.smells.reduce((total, smell) => {
        const hours = smell.severity === 'critical' ? 8 :
                     smell.severity === 'high' ? 4 :
                     smell.severity === 'medium' ? 2 : 1;
        return total + hours;
      }, 0);
      
      expect(report.estimatedDebt).toBe(calculatedDebt);
    });
    
    it('should analyze trends', async () => {
      const report = await codeSmellPredictor.predict(testDir);
      
      expect(report.trends).toBeInstanceOf(Array);
      
      if (report.trends.length > 0) {
        const trend = report.trends[0];
        expect(trend.type).toBeDefined();
        expect(trend.trend).toMatch(/^(improving|worsening|stable)$/);
        expect(typeof trend.change).toBe('number');
      }
    });
  });
  
  describe('edge cases', () => {
    it('should handle empty directory gracefully', async () => {
      const emptyDir = path.join(__dirname, 'empty-test');
      fs.mkdirSync(emptyDir, { recursive: true });
      
      try {
        const report = await codeSmellPredictor.predict(emptyDir);
        expect(report.totalSmells).toBe(0);
        expect(report.critical).toBe(0);
        expect(report.estimatedDebt).toBe(0);
        expect(report.smells).toEqual([]);
        expect(report.trends).toEqual([]);
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });
    
    it('should handle non-existent directory', async () => {
      const nonExistentDir = path.join(__dirname, 'does-not-exist');
      
      const report = await codeSmellPredictor.predict(nonExistentDir);
      expect(report.totalSmells).toBe(0);
      expect(report.critical).toBe(0);
      expect(report.estimatedDebt).toBe(0);
      expect(report.smells).toEqual([]);
      expect(report.trends).toEqual([]);
    });
    
    it('should handle files with syntax errors gracefully', async () => {
      const badFileDir = path.join(__dirname, 'bad-file-test');
      fs.mkdirSync(badFileDir, { recursive: true });
      
      const badFile = `
export function brokenFunction {
  // Missing parentheses - syntax error
  return 'broken';
`;
      
      fs.writeFileSync(path.join(badFileDir, 'bad.ts'), badFile);
      
      try {
        const report = await codeSmellPredictor.predict(badFileDir);
        // Should not crash, just skip the bad file
        expect(report).toBeDefined();
      } finally {
        fs.rmSync(badFileDir, { recursive: true, force: true });
      }
    });
  });
  
  describe('severity classification', () => {
    it('should classify long methods correctly by severity', async () => {
      // Test with different method lengths
      const mediumMethodFile = `
export function mediumLengthFunction() {
  ${Array.from({length: 60}, (_, i) => `console.log('line ${i}');`).join('\n')}
  return 'medium';
}
`;
      
      const highMethodFile = `
export function highLengthFunction() {
  ${Array.from({length: 80}, (_, i) => `console.log('line ${i}');`).join('\n')}
  return 'high';
}
`;
      
      const criticalMethodFile = `
export function criticalLengthFunction() {
  ${Array.from({length: 120}, (_, i) => `console.log('line ${i}');`).join('\n')}
  return 'critical';
}
`;
      
      fs.writeFileSync(path.join(testDir, 'medium-method.ts'), mediumMethodFile);
      fs.writeFileSync(path.join(testDir, 'high-method.ts'), highMethodFile);
      fs.writeFileSync(path.join(testDir, 'critical-method.ts'), criticalMethodFile);
      
      const report = await codeSmellPredictor.predict(testDir);
      
      const longMethodSmells = report.smells.filter(smell => smell.type === 'long-method');
      
      // Check that we have different severity levels
      const severities = new Set(longMethodSmells.map(smell => smell.severity));
      expect(severities.size).toBeGreaterThan(1);
      
      // Verify specific severity classifications
      const mediumSmell = longMethodSmells.find(smell => smell.file.includes('medium-method'));
      expect(mediumSmell?.severity).toBe('medium');
      
      const highSmell = longMethodSmells.find(smell => smell.file.includes('high-method'));
      expect(highSmell?.severity).toBe('high');
      
      const criticalSmell = longMethodSmells.find(smell => smell.file.includes('critical-method'));
      expect(criticalSmell?.severity).toBe('critical');
    });
  });
});
