export interface IaCRule {
  id: string;
  provider: 'terraform' | 'cloudformation' | 'kubernetes';
  resourceType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  check: (resource: any) => boolean;
  recommendation: string;
}

// AWS/Terraform Rules
export const TERRAFORM_RULES: IaCRule[] = [
  // S3 Security
  {
    id: 'TF-S3-001',
    provider: 'terraform',
    resourceType: 'aws_s3_bucket',
    severity: 'critical',
    category: 'data-protection',
    title: 'S3 Bucket Public ACL',
    description: 'S3 bucket has public ACL enabled',
    check: (resource) => resource.acl === 'public-read' || resource.acl === 'public-read-write',
    recommendation: 'Set ACL to private and use bucket policies for access control'
  },
  {
    id: 'TF-S3-002',
    provider: 'terraform',
    resourceType: 'aws_s3_bucket',
    severity: 'high',
    category: 'data-protection',
    title: 'S3 Bucket Encryption Disabled',
    description: 'S3 bucket does not have server-side encryption enabled',
    check: (resource) => !resource.server_side_encryption_configuration,
    recommendation: 'Enable server-side encryption with AWS KMS'
  },
  {
    id: 'TF-S3-003',
    provider: 'terraform',
    resourceType: 'aws_s3_bucket',
    severity: 'medium',
    category: 'data-protection',
    title: 'S3 Bucket Versioning Disabled',
    description: 'S3 bucket versioning is not enabled',
    check: (resource) => !resource.versioning || !resource.versioning[0]?.enabled,
    recommendation: 'Enable versioning for data recovery and audit trail'
  },
  {
    id: 'TF-S3-004',
    provider: 'terraform',
    resourceType: 'aws_s3_bucket',
    severity: 'medium',
    category: 'logging',
    title: 'S3 Bucket Logging Disabled',
    description: 'S3 bucket access logging is not configured',
    check: (resource) => !resource.logging,
    recommendation: 'Enable access logging to track requests'
  },

  // Security Group Rules
  {
    id: 'TF-SG-001',
    provider: 'terraform',
    resourceType: 'aws_security_group',
    severity: 'critical',
    category: 'network-security',
    title: 'Security Group Allows SSH from Internet',
    description: 'Security group allows SSH (port 22) from 0.0.0.0/0',
    check: (resource) => {
      const ingress = resource.ingress || [];
      return ingress.some((rule: any) =>
        rule.from_port === 22 &&
        rule.to_port === 22 &&
        (rule.cidr_blocks?.includes('0.0.0.0/0') || rule.ipv6_cidr_blocks?.includes('::/0'))
      );
    },
    recommendation: 'Restrict SSH access to specific IP addresses or use VPN/bastion host'
  },
  {
    id: 'TF-SG-002',
    provider: 'terraform',
    resourceType: 'aws_security_group',
    severity: 'critical',
    category: 'network-security',
    title: 'Security Group Allows RDP from Internet',
    description: 'Security group allows RDP (port 3389) from 0.0.0.0/0',
    check: (resource) => {
      const ingress = resource.ingress || [];
      return ingress.some((rule: any) =>
        rule.from_port === 3389 &&
        rule.to_port === 3389 &&
        (rule.cidr_blocks?.includes('0.0.0.0/0') || rule.ipv6_cidr_blocks?.includes('::/0'))
      );
    },
    recommendation: 'Restrict RDP access to specific IP addresses or use VPN/bastion host'
  },
  {
    id: 'TF-SG-003',
    provider: 'terraform',
    resourceType: 'aws_security_group',
    severity: 'high',
    category: 'network-security',
    title: 'Security Group Allows All Ports from Internet',
    description: 'Security group allows all ports from 0.0.0.0/0',
    check: (resource) => {
      const ingress = resource.ingress || [];
      return ingress.some((rule: any) =>
        rule.from_port === 0 &&
        rule.to_port === 65535 &&
        (rule.cidr_blocks?.includes('0.0.0.0/0') || rule.ipv6_cidr_blocks?.includes('::/0'))
      );
    },
    recommendation: 'Restrict ingress rules to specific ports and sources'
  },

  // RDS Security
  {
    id: 'TF-RDS-001',
    provider: 'terraform',
    resourceType: 'aws_db_instance',
    severity: 'critical',
    category: 'data-protection',
    title: 'RDS Instance Publicly Accessible',
    description: 'RDS instance is publicly accessible',
    check: (resource) => resource.publicly_accessible === true,
    recommendation: 'Disable public accessibility and use VPN or private subnet'
  },
  {
    id: 'TF-RDS-002',
    provider: 'terraform',
    resourceType: 'aws_db_instance',
    severity: 'high',
    category: 'data-protection',
    title: 'RDS Instance Encryption Disabled',
    description: 'RDS instance does not have encryption at rest enabled',
    check: (resource) => resource.storage_encrypted !== true,
    recommendation: 'Enable storage encryption with AWS KMS'
  },
  {
    id: 'TF-RDS-003',
    provider: 'terraform',
    resourceType: 'aws_db_instance',
    severity: 'medium',
    category: 'data-protection',
    title: 'RDS Automated Backups Disabled',
    description: 'RDS instance does not have automated backups configured',
    check: (resource) => !resource.backup_retention_period || resource.backup_retention_period === 0,
    recommendation: 'Configure automated backups with appropriate retention period'
  },

  // IAM Security
  {
    id: 'TF-IAM-001',
    provider: 'terraform',
    resourceType: 'aws_iam_policy',
    severity: 'critical',
    category: 'access-control',
    title: 'IAM Policy with Admin Privileges',
    description: 'IAM policy grants full administrative privileges (*:*)',
    check: (resource) => {
      const policy = typeof resource.policy === 'string' ? JSON.parse(resource.policy) : resource.policy;
      return policy.Statement?.some((stmt: any) =>
        stmt.Effect === 'Allow' &&
        (stmt.Action === '*' || stmt.Action?.includes('*')) &&
        (stmt.Resource === '*' || stmt.Resource?.includes('*'))
      );
    },
    recommendation: 'Follow principle of least privilege and grant specific permissions'
  },

  // CloudTrail
  {
    id: 'TF-CT-001',
    provider: 'terraform',
    resourceType: 'aws_cloudtrail',
    severity: 'high',
    category: 'logging',
    title: 'CloudTrail Log File Validation Disabled',
    description: 'CloudTrail does not have log file validation enabled',
    check: (resource) => resource.enable_log_file_validation !== true,
    recommendation: 'Enable log file validation to detect tampering'
  },

  // KMS
  {
    id: 'TF-KMS-001',
    provider: 'terraform',
    resourceType: 'aws_kms_key',
    severity: 'medium',
    category: 'data-protection',
    title: 'KMS Key Rotation Disabled',
    description: 'KMS key does not have automatic rotation enabled',
    check: (resource) => resource.enable_key_rotation !== true,
    recommendation: 'Enable automatic key rotation for better security'
  },

  // EBS
  {
    id: 'TF-EBS-001',
    provider: 'terraform',
    resourceType: 'aws_ebs_volume',
    severity: 'high',
    category: 'data-protection',
    title: 'EBS Volume Encryption Disabled',
    description: 'EBS volume is not encrypted',
    check: (resource) => resource.encrypted !== true,
    recommendation: 'Enable EBS volume encryption'
  }
];

// GCP Rules
export const GCP_RULES: IaCRule[] = [
  {
    id: 'GCP-STORAGE-001',
    provider: 'terraform',
    resourceType: 'google_storage_bucket',
    severity: 'critical',
    category: 'data-protection',
    title: 'GCS Bucket Public Access',
    description: 'Storage bucket allows public access',
    check: (resource) => {
      return resource.iam_binding?.some((binding: any) =>
        binding.members?.includes('allUsers') || binding.members?.includes('allAuthenticatedUsers')
      );
    },
    recommendation: 'Remove public access and use IAM for access control'
  },
  {
    id: 'GCP-COMPUTE-001',
    provider: 'terraform',
    resourceType: 'google_compute_firewall',
    severity: 'critical',
    category: 'network-security',
    title: 'GCP Firewall Allows All Traffic',
    description: 'Firewall rule allows all traffic from internet',
    check: (resource) => {
      return resource.source_ranges?.includes('0.0.0.0/0') &&
        resource.allow?.some((rule: any) => rule.protocol === 'all' || rule.ports?.includes('0-65535'));
    },
    recommendation: 'Restrict firewall rules to specific protocols and ports'
  },
  {
    id: 'GCP-SQL-001',
    provider: 'terraform',
    resourceType: 'google_sql_database_instance',
    severity: 'critical',
    category: 'data-protection',
    title: 'Cloud SQL Public IP',
    description: 'Cloud SQL instance has public IP address',
    check: (resource) => {
      return resource.settings?.[0]?.ip_configuration?.[0]?.ipv4_enabled === true;
    },
    recommendation: 'Use private IP and Cloud SQL Proxy for connections'
  }
];

// Azure Rules
export const AZURE_RULES: IaCRule[] = [
  {
    id: 'AZURE-STORAGE-001',
    provider: 'terraform',
    resourceType: 'azurerm_storage_account',
    severity: 'critical',
    category: 'data-protection',
    title: 'Storage Account Public Access',
    description: 'Storage account allows public blob access',
    check: (resource) => resource.allow_blob_public_access === true,
    recommendation: 'Disable public blob access'
  },
  {
    id: 'AZURE-NSG-001',
    provider: 'terraform',
    resourceType: 'azurerm_network_security_rule',
    severity: 'critical',
    category: 'network-security',
    title: 'NSG Allows SSH from Internet',
    description: 'Network security rule allows SSH from internet',
    check: (resource) => {
      return resource.source_address_prefix === '*' &&
        resource.destination_port_range === '22' &&
        resource.access === 'Allow';
    },
    recommendation: 'Restrict source address to specific IPs'
  },
  {
    id: 'AZURE-SQL-001',
    provider: 'terraform',
    resourceType: 'azurerm_mssql_server',
    severity: 'high',
    category: 'network-security',
    title: 'SQL Server Firewall Allows All IPs',
    description: 'SQL Server firewall rule allows all IP addresses',
    check: (resource) => {
      return resource.firewall_rule?.some((rule: any) =>
        rule.start_ip_address === '0.0.0.0' && rule.end_ip_address === '255.255.255.255'
      );
    },
    recommendation: 'Configure specific IP ranges for firewall rules'
  }
];

// Kubernetes Rules
export const KUBERNETES_RULES: IaCRule[] = [
  {
    id: 'K8S-POD-001',
    provider: 'kubernetes',
    resourceType: 'Pod',
    severity: 'critical',
    category: 'pod-security',
    title: 'Privileged Container',
    description: 'Container is running in privileged mode',
    check: (resource) => {
      const containers = resource.spec?.containers || [];
      return containers.some((c: any) => c.securityContext?.privileged === true);
    },
    recommendation: 'Avoid privileged containers unless absolutely necessary'
  },
  {
    id: 'K8S-POD-002',
    provider: 'kubernetes',
    resourceType: 'Pod',
    severity: 'high',
    category: 'pod-security',
    title: 'Host Network Access',
    description: 'Pod has access to host network',
    check: (resource) => resource.spec?.hostNetwork === true,
    recommendation: 'Disable hostNetwork unless required'
  },
  {
    id: 'K8S-POD-003',
    provider: 'kubernetes',
    resourceType: 'Pod',
    severity: 'high',
    category: 'pod-security',
    title: 'Host PID Access',
    description: 'Pod has access to host PID namespace',
    check: (resource) => resource.spec?.hostPID === true,
    recommendation: 'Disable hostPID unless required'
  },
  {
    id: 'K8S-POD-004',
    provider: 'kubernetes',
    resourceType: 'Pod',
    severity: 'medium',
    category: 'pod-security',
    title: 'Running as Root',
    description: 'Container is running as root user',
    check: (resource) => {
      const containers = resource.spec?.containers || [];
      return containers.some((c: any) =>
        !c.securityContext?.runAsNonRoot && c.securityContext?.runAsUser === 0
      );
    },
    recommendation: 'Run containers as non-root user'
  },
  {
    id: 'K8S-POD-005',
    provider: 'kubernetes',
    resourceType: 'Pod',
    severity: 'medium',
    category: 'pod-security',
    title: 'Dangerous Capabilities',
    description: 'Container has dangerous Linux capabilities',
    check: (resource) => {
      const containers = resource.spec?.containers || [];
      const dangerousCaps = ['SYS_ADMIN', 'NET_ADMIN', 'SYS_MODULE', 'CAP_SYS_ADMIN'];
      return containers.some((c: any) =>
        c.securityContext?.capabilities?.add?.some((cap: string) => dangerousCaps.includes(cap))
      );
    },
    recommendation: 'Remove unnecessary capabilities'
  },
  {
    id: 'K8S-POD-006',
    provider: 'kubernetes',
    resourceType: 'Pod',
    severity: 'low',
    category: 'resource-management',
    title: 'Missing Resource Limits',
    description: 'Container does not have resource limits set',
    check: (resource) => {
      const containers = resource.spec?.containers || [];
      return containers.some((c: any) => !c.resources?.limits);
    },
    recommendation: 'Set CPU and memory limits for containers'
  },
  {
    id: 'K8S-POD-007',
    provider: 'kubernetes',
    resourceType: 'Pod',
    severity: 'medium',
    category: 'pod-security',
    title: 'Read-Only Root Filesystem Not Set',
    description: 'Container root filesystem is not read-only',
    check: (resource) => {
      const containers = resource.spec?.containers || [];
      return containers.some((c: any) => c.securityContext?.readOnlyRootFilesystem !== true);
    },
    recommendation: 'Set readOnlyRootFilesystem to true'
  },
  {
    id: 'K8S-SA-001',
    provider: 'kubernetes',
    resourceType: 'Pod',
    severity: 'medium',
    category: 'pod-security',
    title: 'Service Account Token Auto-Mount',
    description: 'Service account token is auto-mounted',
    check: (resource) => resource.spec?.automountServiceAccountToken !== false,
    recommendation: 'Set automountServiceAccountToken to false unless needed'
  }
];

export const ALL_RULES = [
  ...TERRAFORM_RULES,
  ...GCP_RULES,
  ...AZURE_RULES,
  ...KUBERNETES_RULES
];
