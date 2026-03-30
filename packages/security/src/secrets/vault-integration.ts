import { SecretDetection } from './guardian';
import { SecretType } from './patterns';
import { createVaultProvider, VaultProvider, VaultProviderConfig, LocalEnvProvider } from './vault-providers';

/**
 * Vault configuration
 */
export interface VaultConfig {
  type: 'aws_secrets_manager' | 'hashicorp_vault' | 'azure_keyvault' | 'gcp_secret_manager';
  endpoint?: string;
  region?: string;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    token?: string;
  };
}

/**
 * Migration result
 */
export interface VaultMigrationResult {
  secretId: string;
  vaultId: string;
  envVarName: string;
  migrated: boolean;
  error?: string;
}

/**
 * Vault Integration for Secrets
 *
 * Helps migrate hardcoded secrets to secure vaults.
 * Supports AWS Secrets Manager, HashiCorp Vault, Azure Key Vault, and GCP Secret Manager.
 */
export class VaultIntegration {
  private providerCache: Map<string, VaultProvider> = new Map();

  /**
   * Get or create a vault provider
   */
  private getProvider(vaultConfig: VaultConfig): VaultProvider {
    const cacheKey = `${vaultConfig.type}_${vaultConfig.endpoint || 'default'}`;
    
    if (!this.providerCache.has(cacheKey)) {
      const providerConfig: VaultProviderConfig = {
        type: vaultConfig.type,
        region: vaultConfig.region,
        endpoint: vaultConfig.endpoint,
        credentials: vaultConfig.credentials,
      };
      
      try {
        const provider = createVaultProvider(providerConfig);
        this.providerCache.set(cacheKey, provider);
      } catch (error) {
        console.warn(`Failed to create vault provider, falling back to local: ${error}`);
        this.providerCache.set(cacheKey, new LocalEnvProvider());
      }
    }
    
    return this.providerCache.get(cacheKey)!;
  }

  /**
   * Test vault connection
   */
  async testConnection(vaultConfig: VaultConfig): Promise<{ connected: boolean; error?: string }> {
    try {
      const provider = this.getProvider(vaultConfig);
      const connected = await provider.testConnection();
      return { connected };
    } catch (error) {
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  /**
   * Migrate secrets to vault
   * Now uses real vault providers instead of simulation
   */
  async migrateToVault(
    detections: SecretDetection[],
    vaultConfig: VaultConfig
  ): Promise<VaultMigrationResult[]> {
    const results: VaultMigrationResult[] = [];
    const provider = this.getProvider(vaultConfig);

    // Test connection first
    const connectionTest = await this.testConnection(vaultConfig);
    if (!connectionTest.connected) {
      return detections.map(detection => ({
        secretId: detection.id || '',
        vaultId: '',
        envVarName: this.generateEnvVarName(detection),
        migrated: false,
        error: `Vault connection failed: ${connectionTest.error}`,
      }));
    }

    for (const detection of detections) {
      try {
        const envVarName = this.generateEnvVarName(detection);
        
        // Extract the actual secret value from detection
        // Note: For security, the actual value should be extracted during scan
        // maskedValue contains the masked version, snippet contains context
        const secretValue = (detection as any).rawValue || detection.location.snippet || '';
        
        if (!secretValue) {
          results.push({
            secretId: detection.id || '',
            vaultId: '',
            envVarName,
            migrated: false,
            error: 'No secret value found in detection',
          });
          continue;
        }

        // Upload to real vault
        const vaultId = await provider.createSecret(envVarName, secretValue);

        results.push({
          secretId: detection.id || '',
          vaultId,
          envVarName,
          migrated: true,
        });
      } catch (error) {
        results.push({
          secretId: detection.id || '',
          vaultId: '',
          envVarName: this.generateEnvVarName(detection),
          migrated: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Retrieve a secret from vault
   */
  async getSecret(vaultConfig: VaultConfig, secretName: string): Promise<string | null> {
    const provider = this.getProvider(vaultConfig);
    return provider.getSecret(secretName);
  }

  /**
   * List all secrets in vault
   */
  async listSecrets(vaultConfig: VaultConfig): Promise<string[]> {
    const provider = this.getProvider(vaultConfig);
    return provider.listSecrets();
  }

  /**
   * Delete a secret from vault
   */
  async deleteSecret(vaultConfig: VaultConfig, secretName: string): Promise<boolean> {
    const provider = this.getProvider(vaultConfig);
    return provider.deleteSecret(secretName);
  }

  /**
   * Generate environment variable name
   */
  generateEnvVarName(detection: SecretDetection): string {
    const typeMap: Record<SecretType, string> = {
      [SecretType.AWS_ACCESS_KEY]: 'AWS_ACCESS_KEY_ID',
      [SecretType.AWS_SECRET_KEY]: 'AWS_SECRET_ACCESS_KEY',
      [SecretType.GITHUB_TOKEN]: 'GITHUB_TOKEN',
      [SecretType.GOOGLE_API_KEY]: 'GOOGLE_API_KEY',
      [SecretType.STRIPE_KEY]: 'STRIPE_SECRET_KEY',
      [SecretType.JWT_TOKEN]: 'JWT_SECRET',
      [SecretType.PRIVATE_KEY]: 'PRIVATE_KEY',
      [SecretType.DATABASE_URL]: 'DATABASE_URL',
      [SecretType.SLACK_TOKEN]: 'SLACK_TOKEN',
      [SecretType.API_KEY_GENERIC]: 'API_KEY',
      [SecretType.API_KEY]: 'API_KEY',
      [SecretType.TOKEN]: 'TOKEN',
      [SecretType.CERTIFICATE]: 'CERTIFICATE',
      [SecretType.JWT_SECRET]: 'JWT_SECRET',
      [SecretType.PASSWORD]: 'PASSWORD',
      [SecretType.PASSWORD_GENERIC]: 'PASSWORD',
      [SecretType.OTHER]: 'SECRET'
    };

    const baseName = typeMap[detection.secretType as SecretType] || 'SECRET';

    // Add file-based suffix if multiple of same type
    const fileName = detection.filePath.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();

    return `${baseName}_${fileName}`;
  }

  /**
   * Generate code snippet for accessing secret from vault
   */
  generateCodeSnippet(vaultConfig: VaultConfig, envVarName: string): string {
    switch (vaultConfig.type) {
      case 'aws_secrets_manager':
        return `
// AWS Secrets Manager
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "${vaultConfig.region || 'us-east-1'}" });
const response = await client.send(
  new GetSecretValueCommand({ SecretId: "${envVarName}" })
);
const secret = response.SecretString;
`;

      case 'hashicorp_vault':
        return `
// HashiCorp Vault
import vault from "node-vault";

const vaultClient = vault({
  endpoint: "${vaultConfig.endpoint || 'http://127.0.0.1:8200'}",
  token: process.env.VAULT_TOKEN
});

const { data } = await vaultClient.read("secret/data/${envVarName}");
const secret = data.data.value;
`;

      case 'azure_keyvault':
        return `
// Azure Key Vault
import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential } from "@azure/identity";

const credential = new DefaultAzureCredential();
const client = new SecretClient("${vaultConfig.endpoint}", credential);
const secret = await client.getSecret("${envVarName}");
const value = secret.value;
`;

      case 'gcp_secret_manager':
        return `
// GCP Secret Manager
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const [version] = await client.accessSecretVersion({
  name: 'projects/PROJECT_ID/secrets/${envVarName}/versions/latest',
});
const secret = version.payload?.data?.toString();
`;

      default:
        return `// Use environment variable: process.env.${envVarName}`;
    }
  }

  /**
   * Generate migration guide
   */
  generateMigrationGuide(results: VaultMigrationResult[]): string {
    let guide = '# Secrets Migration Guide\n\n';
    guide += '## Detected Secrets\n\n';

    for (const result of results) {
      guide += `### ${result.envVarName}\n`;
      guide += `- Vault ID: ${result.vaultId}\n`;
      guide += `- Status: ${result.migrated ? '✅ Migrated' : '❌ Failed'}\n`;

      if (result.error) {
        guide += `- Error: ${result.error}\n`;
      }

      guide += '\n';
    }

    guide += '## Next Steps\n\n';
    guide += '1. Update your code to fetch secrets from vault\n';
    guide += '2. Remove hardcoded secrets from source code\n';
    guide += '3. Update CI/CD pipelines to use vault credentials\n';
    guide += '4. Test the integration\n';
    guide += '5. Commit and push changes\n';

    return guide;
  }

  /**
   * Verify a secret exists in vault
   */
  async verifySecret(vaultConfig: VaultConfig, secretName: string): Promise<boolean> {
    const secret = await this.getSecret(vaultConfig, secretName);
    return secret !== null;
  }

  /**
   * Batch migrate with progress callback
   */
  async migrateWithProgress(
    detections: SecretDetection[],
    vaultConfig: VaultConfig,
    onProgress?: (completed: number, total: number, current: string) => void
  ): Promise<VaultMigrationResult[]> {
    const results: VaultMigrationResult[] = [];
    const provider = this.getProvider(vaultConfig);
    const total = detections.length;

    for (let i = 0; i < detections.length; i++) {
      const detection = detections[i];
      if (!detection) continue;
      
      const envVarName = this.generateEnvVarName(detection);
      
      if (onProgress) {
        onProgress(i, total, envVarName);
      }

      try {
        const secretValue = (detection as any).rawValue || detection.location.snippet || '';
        if (!secretValue) {
          results.push({
            secretId: detection.id || '',
            vaultId: '',
            envVarName,
            migrated: false,
            error: 'No secret value found',
          });
          continue;
        }

        const vaultId = await provider.createSecret(envVarName, secretValue);
        results.push({
          secretId: detection.id || '',
          vaultId,
          envVarName,
          migrated: true,
        });
      } catch (error) {
        results.push({
          secretId: detection.id || '',
          vaultId: '',
          envVarName,
          migrated: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (onProgress) {
      onProgress(total, total, 'Complete');
    }

    return results;
  }
}

// Export singleton
export const vaultIntegration = new VaultIntegration();
