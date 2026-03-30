import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the storage SDKs
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(),
}));

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: vi.fn(),
}));

describe('FileStorageService', () => {
  describe('Storage Providers', () => {
    it('should initialize S3 provider with valid config', () => {
      const { S3StorageProvider } = require('../file-storage-service');

      const config = {
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        bucket: 'test-bucket',
        region: 'us-east-1',
      };

      expect(() => new S3StorageProvider(config)).not.toThrow();
    });

    it('should throw error for incomplete S3 config', () => {
      const { S3StorageProvider } = require('../file-storage-service');

      const config = {
        accessKeyId: 'test-key',
        // missing secretAccessKey, bucket, region
      };

      expect(() => new S3StorageProvider(config)).toThrow('S3 configuration incomplete');
    });

    it('should initialize GCS provider with valid config', () => {
      const { GoogleCloudStorageProvider } = require('../file-storage-service');

      const config = {
        projectId: 'test-project',
        bucket: 'test-bucket',
        keyFilename: '/path/to/key.json',
      };

      expect(() => new GoogleCloudStorageProvider(config)).not.toThrow();
    });

    it('should throw error for incomplete GCS config', () => {
      const { GoogleCloudStorageProvider } = require('../file-storage-service');

      const config = {
        projectId: 'test-project',
        // missing bucket and keyFilename
      };

      expect(() => new GoogleCloudStorageProvider(config)).toThrow('Google Cloud configuration incomplete');
    });

    it('should initialize Azure provider with valid config', () => {
      const { AzureStorageProvider } = require('../file-storage-service');

      const config = {
        connectionString: 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net',
        container: 'test-container',
      };

      expect(() => new AzureStorageProvider(config)).not.toThrow();
    });

    it('should throw error for incomplete Azure config', () => {
      const { AzureStorageProvider } = require('../file-storage-service');

      const config = {
        // missing connectionString and container
      };

      expect(() => new AzureStorageProvider(config)).toThrow('Azure configuration is required');
    });
  });
});