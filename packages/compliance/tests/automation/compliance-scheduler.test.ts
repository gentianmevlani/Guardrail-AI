
import { ComplianceScheduler } from '../../src/automation/compliance-scheduler';
import { complianceAutomationEngine } from '../../src/frameworks/engine';
import { evidenceCollector } from '../../src/automation/evidence-collector';
import { prisma } from '@guardrail/database';
import { reportingEngine } from '../../src/automation/reporting-engine';

// Mock dependencies
jest.mock('@guardrail/database', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
    },
    complianceSchedule: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../src/frameworks/engine', () => ({
  complianceAutomationEngine: {
    assess: jest.fn(),
  },
}));

jest.mock('../../src/automation/evidence-collector', () => ({
  evidenceCollector: {
    collectForAssessment: jest.fn(),
  },
}));

jest.mock('../../src/automation/reporting-engine', () => ({
  reportingEngine: {
    generateReport: jest.fn(),
  },
}));

describe('ComplianceScheduler', () => {
  let scheduler: ComplianceScheduler;

  beforeEach(() => {
    scheduler = new ComplianceScheduler();
    jest.clearAllMocks();
  });

  describe('runCheck', () => {
    const projectId = 'test-project';
    const frameworkId = 'test-framework';
    const mockProject = { id: projectId, path: '/path/to/project' };
    const mockAssessment = {
      summary: { score: 85 },
      controls: [],
    };
    const mockEvidence = [{ id: 'ev1' }];
    const mockReport = { id: 'report1' };

    beforeEach(() => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (complianceAutomationEngine.assess as jest.Mock).mockResolvedValue(mockAssessment);
      (evidenceCollector.collectForAssessment as jest.Mock).mockResolvedValue(mockEvidence);
      (reportingEngine.generateReport as jest.Mock).mockResolvedValue(mockReport);
    });

    it('should run assessment and collect evidence when requested', async () => {
      await scheduler.runCheck(projectId, frameworkId, { collectEvidence: true });

      expect(prisma.project.findUnique).toHaveBeenCalledWith({ where: { id: projectId } });
      expect(complianceAutomationEngine.assess).toHaveBeenCalledWith(
        mockProject.path,
        frameworkId,
        projectId
      );

      // Verify evidence collection happens after assessment
      expect(evidenceCollector.collectForAssessment).toHaveBeenCalledWith(
        projectId,
        frameworkId,
        mockAssessment
      );
    });

    it('should skip evidence collection when explicitly disabled', async () => {
      await scheduler.runCheck(projectId, frameworkId, { collectEvidence: false });

      expect(complianceAutomationEngine.assess).toHaveBeenCalled();
      expect(evidenceCollector.collectForAssessment).not.toHaveBeenCalled();
    });

    it('should generate report when requested', async () => {
      await scheduler.runCheck(projectId, frameworkId, {
        collectEvidence: true,
        generateReport: true
      });

      expect(reportingEngine.generateReport).toHaveBeenCalledWith(expect.objectContaining({
        projectId,
        frameworkId,
        includeEvidence: true,
      }));
    });
  });
});
