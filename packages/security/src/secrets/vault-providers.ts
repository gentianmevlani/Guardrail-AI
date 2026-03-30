/**
 * Vault Providers
 * 
 * Real implementations for secret vault integrations:
 * - AWS Secrets Manager
 * - HashiCorp Vault
 * - Azure Key Vault
 * - GCP Secret Manager
 */


export interface VaultProvider {
  name: string;
  createSecret(name: string, value: string): Promise<string>;
  getSecret(name: string): Promise<string | null>;
  deleteSecret(name: string): Promise<boolean>;
  listSecrets(): Promise<string[]>;
  testConnection(): Promise<boolean>;
}

export interface VaultProviderConfig {
  type: 'aws_secrets_manager' | 'hashicorp_vault' | 'azure_keyvault' | 'gcp_secret_manager';
  region?: string;
  endpoint?: string;
  projectId?: string;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
    tenantId?: string;
  };
}

/**
 * AWS Secrets Manager Provider
 */
export class AWSSecretsManagerProvider implements VaultProvider {
  name = 'AWS Secrets Manager';
  private client: any;
  private region: string;

  constructor(config: VaultProviderConfig) {
    this.region = config.region || 'us-east-1';
  }

  private async getClient() {
    if (!this.client) {
      const { SecretsManagerClient } = await import('@aws-sdk/client-secrets-manager');
      this.client = new SecretsManagerClient({ region: this.region });
    }
    return this.client;
  }

  async createSecret(name: string, value: string): Promise<string> {
    const client = await this.getClient();
    const { CreateSecretCommand } = await import('@aws-sdk/client-secrets-manager');
    
    try {
      const result = await client.send(new CreateSecretCommand({
        Name: name,
        SecretString: value,
        Description: 'Migrated by guardrail AI',
      }));
      return result.ARN || name;
    } catch (error: any) {
      if (error.name === 'ResourceExistsException') {
        const { PutSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
        await client.send(new PutSecretValueCommand({
          SecretId: name,
          SecretString: value,
        }));
        return name;
      }
      throw error;
    }
  }

  async getSecret(name: string): Promise<string | null> {
    const client = await this.getClient();
    const { GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
    
    try {
      const result = await client.send(new GetSecretValueCommand({ SecretId: name }));
      return result.SecretString || null;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  async deleteSecret(name: string): Promise<boolean> {
    const client = await this.getClient();
    const { DeleteSecretCommand } = await import('@aws-sdk/client-secrets-manager');
    
    try {
      await client.send(new DeleteSecretCommand({
        SecretId: name,
        ForceDeleteWithoutRecovery: false,
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  async listSecrets(): Promise<string[]> {
    const client = await this.getClient();
    const { ListSecretsCommand } = await import('@aws-sdk/client-secrets-manager');
    
    const result = await client.send(new ListSecretsCommand({}));
    return (result.SecretList || []).map((s: any) => s.Name).filter(Boolean);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.listSecrets();
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * HashiCorp Vault Provider
 */
export class HashiCorpVaultProvider implements VaultProvider {
  name = 'HashiCorp Vault';
  private client: any;
  private endpoint: string;
  private token: string;
  private mountPath: string;

  constructor(config: VaultProviderConfig) {
    this.endpoint = config.endpoint || 'http://127.0.0.1:8200';
    this.token = config.credentials?.token || process.env['VAULT_TOKEN'] || '';
    this.mountPath = 'secret';
  }

  private async getClient() {
    if (!this.client) {
      const vault = (await import('node-vault')).default;
      this.client = vault({
        endpoint: this.endpoint,
        token: this.token,
      });
    }
    return this.client;
  }

  async createSecret(name: string, value: string): Promise<string> {
    const client = await this.getClient();
    const path = `${this.mountPath}/data/${name}`;
    
    await client.write(path, {
      data: { value },
      metadata: { created_by: 'guardrail-ai' },
    });
    
    return path;
  }

  async getSecret(name: string): Promise<string | null> {
    const client = await this.getClient();
    const path = `${this.mountPath}/data/${name}`;
    
    try {
      const result = await client.read(path);
      return result?.data?.data?.value || null;
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteSecret(name: string): Promise<boolean> {
    const client = await this.getClient();
    const path = `${this.mountPath}/metadata/${name}`;
    
    try {
      await client.delete(path);
      return true;
    } catch (error) {
      return false;
    }
  }

  async listSecrets(): Promise<string[]> {
    const client = await this.getClient();
    const path = `${this.mountPath}/metadata`;
    
    try {
      const result = await client.list(path);
      return result?.data?.keys || [];
    } catch (error) {
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.health();
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Azure Key Vault Provider
 */
export class AzureKeyVaultProvider implements VaultProvider {
  name = 'Azure Key Vault';
  private client: any;
  private vaultUrl: string;

  constructor(config: VaultProviderConfig) {
    this.vaultUrl = config.endpoint || '';
    if (!this.vaultUrl) {
      throw new Error('Azure Key Vault URL is required');
    }
  }

  private async getClient() {
    if (!this.client) {
      const { SecretClient } = await import('@azure/keyvault-secrets');
      const { DefaultAzureCredential } = await import('@azure/identity');
      
      const credential = new DefaultAzureCredential();
      this.client = new SecretClient(this.vaultUrl, credential);
    }
    return this.client;
  }

  async createSecret(name: string, value: string): Promise<string> {
    const client = await this.getClient();
    const sanitizedName = name.replace(/[^a-zA-Z0-9-]/g, '-');
    
    const result = await client.setSecret(sanitizedName, value, {
      tags: { createdBy: 'guardrail-ai' },
    });
    
    return result.properties.id || sanitizedName;
  }

  async getSecret(name: string): Promise<string | null> {
    const client = await this.getClient();
    const sanitizedName = name.replace(/[^a-zA-Z0-9-]/g, '-');
    
    try {
      const result = await client.getSecret(sanitizedName);
      return result.value || null;
    } catch (error: any) {
      if (error.code === 'SecretNotFound') {
        return null;
      }
      throw error;
    }
  }

  async deleteSecret(name: string): Promise<boolean> {
    const client = await this.getClient();
    const sanitizedName = name.replace(/[^a-zA-Z0-9-]/g, '-');
    
    try {
      await client.beginDeleteSecret(sanitizedName);
      return true;
    } catch (error) {
      return false;
    }
  }

  async listSecrets(): Promise<string[]> {
    const client = await this.getClient();
    const secrets: string[] = [];
    
    for await (const secretProperties of client.listPropertiesOfSecrets()) {
      secrets.push(secretProperties.name);
    }
    
    return secrets;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.listSecrets();
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * GCP Secret Manager Provider
 */
export class GCPSecretManagerProvider implements VaultProvider {
  name = 'GCP Secret Manager';
  private client: any;
  private projectId: string;

  constructor(config: VaultProviderConfig) {
    this.projectId = config.projectId || process.env['GOOGLE_CLOUD_PROJECT'] || '';
    if (!this.projectId) {
      throw new Error('GCP Project ID is required');
    }
  }

  private async getClient() {
    if (!this.client) {
      const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
      this.client = new SecretManagerServiceClient();
    }
    return this.client;
  }

  async createSecret(name: string, value: string): Promise<string> {
    const client = await this.getClient();
    const parent = `projects/${this.projectId}`;
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    try {
      await client.createSecret({
        parent,
        secretId: sanitizedName,
        secret: {
          replication: { automatic: {} },
          labels: { created_by: 'guardrail-ai' },
        },
      });
    } catch (error: any) {
      if (error.code !== 6) {
        throw error;
      }
    }

    const secretName = `${parent}/secrets/${sanitizedName}`;
    await client.addSecretVersion({
      parent: secretName,
      payload: { data: Buffer.from(value, 'utf8') },
    });

    return secretName;
  }

  async getSecret(name: string): Promise<string | null> {
    const client = await this.getClient();
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const secretName = `projects/${this.projectId}/secrets/${sanitizedName}/versions/latest`;
    
    try {
      const [version] = await client.accessSecretVersion({ name: secretName });
      return version.payload?.data?.toString() || null;
    } catch (error: any) {
      if (error.code === 5) {
        return null;
      }
      throw error;
    }
  }

  async deleteSecret(name: string): Promise<boolean> {
    const client = await this.getClient();
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const secretName = `projects/${this.projectId}/secrets/${sanitizedName}`;
    
    try {
      await client.deleteSecret({ name: secretName });
      return true;
    } catch (error) {
      return false;
    }
  }

  async listSecrets(): Promise<string[]> {
    const client = await this.getClient();
    const parent = `projects/${this.projectId}`;
    
    const [secrets] = await client.listSecrets({ parent });
    return secrets.map((s: any) => s.name?.split('/').pop()).filter(Boolean);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.listSecrets();
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Factory function to create vault provider
 */
export function createVaultProvider(config: VaultProviderConfig): VaultProvider {
  switch (config.type) {
    case 'aws_secrets_manager':
      return new AWSSecretsManagerProvider(config);
    case 'hashicorp_vault':
      return new HashiCorpVaultProvider(config);
    case 'azure_keyvault':
      return new AzureKeyVaultProvider(config);
    case 'gcp_secret_manager':
      return new GCPSecretManagerProvider(config);
    default:
      throw new Error(`Unsupported vault type: ${config.type}`);
  }
}

/**
 * Local environment provider (for development/testing)
 */
export class LocalEnvProvider implements VaultProvider {
  name = 'Local Environment';
  private secrets: Map<string, string> = new Map();

  async createSecret(name: string, value: string): Promise<string> {
    this.secrets.set(name, value);
    return `local://${name}`;
  }

  async getSecret(name: string): Promise<string | null> {
    return this.secrets.get(name) || process.env[name] || null;
  }

  async deleteSecret(name: string): Promise<boolean> {
    return this.secrets.delete(name);
  }

  async listSecrets(): Promise<string[]> {
    return Array.from(this.secrets.keys());
  }

  async testConnection(): Promise<boolean> {
    return true;
  }
}
