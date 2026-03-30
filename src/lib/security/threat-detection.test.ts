import { AdvancedThreatDetection, ThreatIntelSource } from './threat-detection';

// Mock dependencies
jest.mock('./zero-trust-engine', () => ({
  zeroTrustEngine: {
    revokeSession: jest.fn(),
  },
}));

// Mock global fetch
global.fetch = jest.fn();

describe('AdvancedThreatDetection', () => {
  let threatDetection: AdvancedThreatDetection;

  beforeEach(() => {
    threatDetection = new AdvancedThreatDetection();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('fetchThreatIntel', () => {
    it('should fetch and parse threat data correctly', async () => {
      const source: ThreatIntelSource = {
        name: 'Test Source',
        type: 'api',
        url: 'https://api.example.com/threats',
        apiKey: 'test-key',
        enabled: true,
        priority: 1,
        lastFetch: new Date(),
        fetchCount: 0,
      };

      const mockData = [
        {
          type: 'ip',
          value: '192.168.1.1',
          severity: 'high',
          category: 'malware',
          confidence: 0.9,
          tags: ['botnet'],
          description: 'Malicious IP',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      // We access the private method using any cast
      const results = await (threatDetection as any).fetchThreatIntel(source);

      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/threats', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer test-key',
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: 'ip',
        value: '192.168.1.1',
        severity: 'high',
        category: 'malware',
        source: 'Test Source',
        confidence: 0.9,
        tags: ['botnet'],
        description: 'Malicious IP',
      });
    });

    it('should handle API errors gracefully', async () => {
      const source: ThreatIntelSource = {
        name: 'Test Source',
        type: 'api',
        url: 'https://api.example.com/threats',
        enabled: true,
        priority: 1,
        lastFetch: new Date(),
        fetchCount: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const results = await (threatDetection as any).fetchThreatIntel(source);
      expect(results).toEqual([]);
    });

    it('should handle parsing errors gracefully', async () => {
      const source: ThreatIntelSource = {
        name: 'Test Source',
        type: 'api',
        url: 'https://api.example.com/threats',
        enabled: true,
        priority: 1,
        lastFetch: new Date(),
        fetchCount: 0,
      };

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const results = await (threatDetection as any).fetchThreatIntel(source);
      expect(results).toEqual([]);
    });

    it('should handle different data structures', async () => {
        const source: ThreatIntelSource = {
          name: 'Structure Test',
          type: 'api',
          url: 'https://api.example.com/threats',
          enabled: true,
          priority: 1,
          lastFetch: new Date(),
          fetchCount: 0,
        };

        const mockData = {
            indicators: [
                {
                    indicator: '10.0.0.1',
                    type: 'ip',
                    severity: 'critical'
                }
            ]
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => mockData,
        });

        const results = await (threatDetection as any).fetchThreatIntel(source);

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
          type: 'ip',
          value: '10.0.0.1',
          severity: 'critical',
          source: 'Structure Test'
        });
      });
  });
});
