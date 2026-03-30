import { prisma } from '@guardrail/database';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { K8S_RULES } from './rules';

export interface K8sManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
  };
  spec: any;
}

export interface K8sFinding {
  ruleId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resourceType: string;
  resourceName: string;
  namespace?: string;
  filePath: string;
  recommendation: string;
}

export interface RBACAnalysis {
  roles: Array<{
    name: string;
    namespace?: string;
    rules: any[];
    riskyPermissions: string[];
  }>;
  roleBindings: Array<{
    name: string;
    namespace?: string;
    subjects: any[];
    roleRef: any;
  }>;
  findings: string[];
}

export interface PodSecurityAnalysis {
  totalPods: number;
  privilegedPods: number;
  hostNetworkPods: number;
  runAsRootPods: number;
  findings: K8sFinding[];
}

export interface NetworkPolicyAnalysis {
  hasNetworkPolicies: boolean;
  totalPolicies: number;
  unprotectedNamespaces: string[];
  findings: string[];
}

export interface KubernetesScanResult {
  projectId: string;
  summary: {
    totalResources: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  findings: K8sFinding[];
  rbacAnalysis?: RBACAnalysis;
  podSecurity?: PodSecurityAnalysis;
  networkPolicies?: NetworkPolicyAnalysis;
}

export class KubernetesScanner {
  /**
   * Scan Kubernetes manifests
   */
  async scanManifests(projectPath: string, projectId: string): Promise<KubernetesScanResult> {
    // Find all Kubernetes manifest files
    const manifestFiles = this.findManifestFiles(projectPath);
    const manifests: Array<{ manifest: K8sManifest; filePath: string }> = [];

    for (const file of manifestFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const docs = this.parseYAML(content);

        // Handle multiple documents in one file
        const docArray = Array.isArray(docs) ? docs : [docs];

        for (const doc of docArray) {
          if (doc && doc.kind && doc.metadata) {
            manifests.push({
              manifest: doc,
              filePath: file
            });
          }
        }
      } catch (error) {
        console.error(`Error parsing manifest ${file}:`, error);
      }
    }

    // Scan for security issues
    const findings = this.scanForSecurityIssues(manifests);

    // Analyze RBAC
    const rbacAnalysis = await this.analyzeRBAC(manifests.map(m => m.manifest));

    // Check pod security
    const podSecurity = await this.checkPodSecurity(manifests.map(m => m.manifest));

    // Validate network policies
    const networkPolicies = await this.validateNetworkPolicies(manifests.map(m => m.manifest));

    const summary = {
      totalResources: manifests.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length
    };

    // Save to database
    try {
      await (prisma as any).kubernetesScan.create({
        data: {
          projectId,
          clusterName: 'default',
          findings: findings as any,
          results: {
            findings,
            summary,
            rbacAnalysis,
            podSecurity,
            networkPolicies
          } as any,
          status: summary.critical > 0 ? 'failed' : summary.high > 0 ? 'warning' : 'passed'
        }
      });
    } catch (error) {
      // Table may not exist - continue
    }

    return {
      projectId,
      summary,
      findings,
      rbacAnalysis,
      podSecurity,
      networkPolicies
    };
  }

  /**
   * Analyze RBAC configuration
   */
  async analyzeRBAC(manifests: K8sManifest[]): Promise<RBACAnalysis> {
    const roles = manifests.filter(m => m.kind === 'Role' || m.kind === 'ClusterRole');
    const roleBindings = manifests.filter(m => m.kind === 'RoleBinding' || m.kind === 'ClusterRoleBinding');

    const findings: string[] = [];
    const analyzedRoles = [];

    for (const role of roles) {
      const riskyPermissions: string[] = [];
      const rules = role.spec?.rules || [];

      for (const rule of rules) {
        // Check for wildcard permissions
        if (rule.verbs?.includes('*')) {
          riskyPermissions.push('Wildcard verb permissions');
        }

        if (rule.resources?.includes('*')) {
          riskyPermissions.push('Wildcard resource permissions');
        }

        // Check for dangerous permissions
        const dangerousVerbs = ['create', 'delete', 'deletecollection'];
        const dangerousResources = ['secrets', 'pods/exec', 'pods/portforward'];

        if (dangerousVerbs.some(v => rule.verbs?.includes(v)) &&
            dangerousResources.some(r => rule.resources?.includes(r))) {
          riskyPermissions.push(`Dangerous permissions: ${rule.verbs.join(',')} on ${rule.resources.join(',')}`);
        }
      }

      analyzedRoles.push({
        name: role.metadata.name,
        namespace: role.metadata.namespace,
        rules,
        riskyPermissions
      });

      if (riskyPermissions.length > 0) {
        findings.push(`Role ${role.metadata.name} has risky permissions: ${riskyPermissions.join(', ')}`);
      }
    }

    return {
      roles: analyzedRoles,
      roleBindings: roleBindings.map(rb => ({
        name: rb.metadata.name,
        namespace: rb.metadata.namespace,
        subjects: rb.spec?.subjects || [],
        roleRef: rb.spec?.roleRef || {}
      })),
      findings
    };
  }

  /**
   * Check pod security
   */
  async checkPodSecurity(manifests: K8sManifest[]): Promise<PodSecurityAnalysis> {
    const pods = manifests.filter(m =>
      m.kind === 'Pod' || m.kind === 'Deployment' || m.kind === 'StatefulSet' || m.kind === 'DaemonSet'
    );

    let privilegedPods = 0;
    let hostNetworkPods = 0;
    let runAsRootPods = 0;
    const findings: K8sFinding[] = [];

    for (const pod of pods) {
      // Get pod spec (handle Deployment/StatefulSet template)
      const podSpec = pod.kind === 'Pod' ? pod.spec : pod.spec?.template?.spec;

      if (!podSpec) continue;

      // Check for privileged containers
      const containers = podSpec.containers || [];
      const isPrivileged = containers.some((c: any) => c.securityContext?.privileged === true);
      if (isPrivileged) privilegedPods++;

      // Check for host network
      if (podSpec.hostNetwork === true) hostNetworkPods++;

      // Check for running as root
      const runAsRoot = containers.some((c: any) =>
        !c.securityContext?.runAsNonRoot && c.securityContext?.runAsUser === 0
      );
      if (runAsRoot) runAsRootPods++;
    }

    return {
      totalPods: pods.length,
      privilegedPods,
      hostNetworkPods,
      runAsRootPods,
      findings
    };
  }

  /**
   * Validate network policies
   */
  async validateNetworkPolicies(manifests: K8sManifest[]): Promise<NetworkPolicyAnalysis> {
    const networkPolicies = manifests.filter(m => m.kind === 'NetworkPolicy');
    const namespaces = new Set<string>();
    const findings: string[] = [];

    // Collect all namespaces
    for (const manifest of manifests) {
      if (manifest.metadata.namespace) {
        namespaces.add(manifest.metadata.namespace);
      }
    }

    // Check which namespaces have network policies
    const namespacesWithPolicies = new Set(
      networkPolicies.map(np => np.metadata.namespace).filter(Boolean)
    );

    const unprotectedNamespaces = Array.from(namespaces).filter(ns =>
      !namespacesWithPolicies.has(ns)
    );

    if (unprotectedNamespaces.length > 0) {
      findings.push(`${unprotectedNamespaces.length} namespaces without network policies`);
    }

    return {
      hasNetworkPolicies: networkPolicies.length > 0,
      totalPolicies: networkPolicies.length,
      unprotectedNamespaces,
      findings
    };
  }

  /**
   * Scan for security issues using rules
   */
  private scanForSecurityIssues(manifests: Array<{ manifest: K8sManifest; filePath: string }>): K8sFinding[] {
    const findings: K8sFinding[] = [];

    for (const { manifest, filePath } of manifests) {
      // Skip non-pod resources for pod security checks
      const isPodResource = ['Pod', 'Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'].includes(manifest.kind);

      if (!isPodResource) continue;

      // Get pod spec
      const podSpec = manifest.kind === 'Pod' ? manifest.spec : manifest.spec?.template?.spec;

      if (!podSpec) continue;

      // Create a resource object compatible with rules
      const resource = {
        kind: manifest.kind,
        metadata: manifest.metadata,
        spec: podSpec
      };

      // Check against rules
      for (const rule of K8S_RULES) {
        if (rule.check(resource)) {
          findings.push({
            ruleId: rule.id,
            title: rule.title,
            description: rule.description,
            severity: rule.severity,
            resourceType: manifest.kind,
            resourceName: manifest.metadata.name,
            namespace: manifest.metadata.namespace,
            filePath,
            recommendation: rule.recommendation
          });
        }
      }
    }

    return findings;
  }

  /**
   * Find Kubernetes manifest files
   */
  private findManifestFiles(dir: string): string[] {
    const files: string[] = [];
    const extensions = ['.yaml', '.yml'];

    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          files.push(...this.findManifestFiles(fullPath));
        } else if (stat.isFile()) {
          if (extensions.some(ext => entry.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignore permission errors
    }

    return files;
  }

  /**
   * Simple YAML parser (in production, use proper YAML library)
   */
  private parseYAML(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      // Simplified - would use yaml library in production
      return {};
    }
  }
}

export const kubernetesScanner = new KubernetesScanner();
