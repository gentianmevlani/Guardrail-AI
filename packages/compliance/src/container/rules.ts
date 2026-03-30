export interface DockerfileRule {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  check: (instruction: string, value: string) => boolean;
  recommendation: string;
}

export interface K8sRule {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  check: (resource: any) => boolean;
  recommendation: string;
}

/**
 * Dockerfile Security Rules
 */
export const DOCKERFILE_RULES: DockerfileRule[] = [
  {
    id: 'DOCKER-001',
    title: 'Running as Root',
    description: 'Container runs as root user',
    severity: 'high',
    category: 'user-security',
    check: (_instruction, _value) => {
      // Check if USER instruction is missing or set to root
      return _instruction === 'USER' && (_value === 'root' || _value === '0');
    },
    recommendation: 'Use a non-root user: USER node or USER 1000'
  },
  {
    id: 'DOCKER-002',
    title: 'Using Latest Tag',
    description: 'Base image uses :latest tag',
    severity: 'medium',
    category: 'versioning',
    check: (_instruction, _value) => {
      return _instruction === 'FROM' && _value.endsWith(':latest');
    },
    recommendation: 'Pin to specific version: FROM node:20.11.0'
  },
  {
    id: 'DOCKER-003',
    title: 'Missing Health Check',
    description: 'No HEALTHCHECK instruction defined',
    severity: 'low',
    category: 'reliability',
    check: (_instruction, _value) => {
      // This would be checked at the Dockerfile level, not per instruction
      return false;
    },
    recommendation: 'Add HEALTHCHECK instruction'
  },
  {
    id: 'DOCKER-004',
    title: 'Secrets in ENV',
    description: 'Potential secrets in ENV instruction',
    severity: 'critical',
    category: 'secrets',
    check: (_instruction, _value) => {
      if (_instruction !== 'ENV') return false;
      const secretKeywords = ['password', 'secret', 'key', 'token', 'api_key'];
      return secretKeywords.some(keyword => _value.toLowerCase().includes(keyword));
    },
    recommendation: 'Use build-time secrets or runtime secret management'
  },
  {
    id: 'DOCKER-005',
    title: 'ADD Instead of COPY',
    description: 'Using ADD instead of COPY',
    severity: 'low',
    category: 'best-practices',
    check: (_instruction, _value) => {
      return _instruction === 'ADD';
    },
    recommendation: 'Use COPY instead of ADD unless you need tar extraction or URL fetching'
  },
  {
    id: 'DOCKER-006',
    title: 'Missing Multi-Stage Build',
    description: 'Not using multi-stage builds',
    severity: 'low',
    category: 'optimization',
    check: (_instruction, _value) => {
      // Would check if multiple FROM instructions exist
      return false;
    },
    recommendation: 'Use multi-stage builds to reduce image size'
  },
  {
    id: 'DOCKER-007',
    title: 'Exposing Privileged Ports',
    description: 'Exposing ports below 1024',
    severity: 'medium',
    category: 'security',
    check: (_instruction, _value) => {
      if (_instruction !== 'EXPOSE' || !_value) return false;
      const port = parseInt(_value.split('/')[0] || '', 10);
      return port < 1024;
    },
    recommendation: 'Use ports above 1024 to avoid running as root'
  }
];

/**
 * Kubernetes Security Rules
 */
export const K8S_RULES: K8sRule[] = [
  {
    id: 'K8S-SEC-001',
    title: 'Privileged Container',
    description: 'Container running in privileged mode',
    severity: 'critical',
    category: 'pod-security',
    check: (resource) => {
      const containers = resource.spec?.containers || [];
      return containers.some((c: any) => c.securityContext?.privileged === true);
    },
    recommendation: 'Remove privileged: true from securityContext'
  },
  {
    id: 'K8S-SEC-002',
    title: 'Host Network',
    description: 'Pod has access to host network',
    severity: 'high',
    category: 'pod-security',
    check: (resource) => {
      return resource.spec?.hostNetwork === true;
    },
    recommendation: 'Set hostNetwork: false or remove the field'
  },
  {
    id: 'K8S-SEC-003',
    title: 'Host PID Namespace',
    description: 'Pod has access to host PID namespace',
    severity: 'high',
    category: 'pod-security',
    check: (resource) => {
      return resource.spec?.hostPID === true;
    },
    recommendation: 'Set hostPID: false or remove the field'
  },
  {
    id: 'K8S-SEC-004',
    title: 'Host IPC Namespace',
    description: 'Pod has access to host IPC namespace',
    severity: 'high',
    category: 'pod-security',
    check: (resource) => {
      return resource.spec?.hostIPC === true;
    },
    recommendation: 'Set hostIPC: false or remove the field'
  },
  {
    id: 'K8S-SEC-005',
    title: 'Root User',
    description: 'Container running as root',
    severity: 'high',
    category: 'pod-security',
    check: (resource) => {
      const containers = resource.spec?.containers || [];
      return containers.some((c: any) =>
        !c.securityContext?.runAsNonRoot && c.securityContext?.runAsUser === 0
      );
    },
    recommendation: 'Set runAsNonRoot: true in securityContext'
  },
  {
    id: 'K8S-SEC-006',
    title: 'Dangerous Capabilities',
    description: 'Container has dangerous Linux capabilities',
    severity: 'high',
    category: 'pod-security',
    check: (resource) => {
      const containers = resource.spec?.containers || [];
      const dangerous = ['SYS_ADMIN', 'NET_ADMIN', 'SYS_MODULE'];
      return containers.some((c: any) =>
        c.securityContext?.capabilities?.add?.some((cap: string) =>
          dangerous.includes(cap)
        )
      );
    },
    recommendation: 'Remove dangerous capabilities or use allowPrivilegeEscalation: false'
  },
  {
    id: 'K8S-SEC-007',
    title: 'Read-Only Root Filesystem',
    description: 'Root filesystem is not read-only',
    severity: 'medium',
    category: 'pod-security',
    check: (resource) => {
      const containers = resource.spec?.containers || [];
      return containers.some((c: any) =>
        c.securityContext?.readOnlyRootFilesystem !== true
      );
    },
    recommendation: 'Set readOnlyRootFilesystem: true in securityContext'
  },
  {
    id: 'K8S-RES-001',
    title: 'Missing Resource Limits',
    description: 'Container missing CPU/memory limits',
    severity: 'medium',
    category: 'resource-management',
    check: (resource) => {
      const containers = resource.spec?.containers || [];
      return containers.some((c: any) =>
        !c.resources?.limits || !c.resources?.limits?.cpu || !c.resources?.limits?.memory
      );
    },
    recommendation: 'Set resources.limits.cpu and resources.limits.memory'
  },
  {
    id: 'K8S-RES-002',
    title: 'Missing Resource Requests',
    description: 'Container missing CPU/memory requests',
    severity: 'low',
    category: 'resource-management',
    check: (resource) => {
      const containers = resource.spec?.containers || [];
      return containers.some((c: any) =>
        !c.resources?.requests || !c.resources?.requests?.cpu || !c.resources?.requests?.memory
      );
    },
    recommendation: 'Set resources.requests.cpu and resources.requests.memory'
  },
  {
    id: 'K8S-SA-001',
    title: 'Service Account Token Auto-Mount',
    description: 'Service account token auto-mounted',
    severity: 'medium',
    category: 'pod-security',
    check: (resource) => {
      return resource.spec?.automountServiceAccountToken !== false;
    },
    recommendation: 'Set automountServiceAccountToken: false unless needed'
  }
];
