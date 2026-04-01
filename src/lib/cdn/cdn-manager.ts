import { CloudFrontClient, CreateDistributionCommand, UpdateDistributionCommand } from '@aws-sdk/client-cloudfront';
import { S3Client, PutObjectCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface CDNConfig {
  distributionId?: string;
  domain: string;
  origins: CDNDistributionOrigin[];
  cacheBehaviors: CacheBehavior[];
  defaultCacheBehavior: DefaultCacheBehavior;
  customErrorResponses?: CustomErrorResponse[];
  restrictions?: CDNRestrictions;
  viewerCertificate?: ViewerCertificate;
}

export interface CDNDistributionOrigin {
  domainName: string;
  originId: string;
  originPath?: string;
  customHeaders?: { [key: string]: string };
  s3OriginConfig?: {
    originAccessIdentity: string;
  };
  customOriginConfig?: {
    httpPort: number;
    httpsPort: number;
    originProtocolPolicy: 'http-only' | 'https-only' | 'match-viewer';
    originSslProtocols: string[];
    originReadTimeout?: number;
    originKeepaliveTimeout?: number;
  };
}

export interface CacheBehavior {
  pathPattern: string;
  targetOriginId: string;
  viewerProtocolPolicy: 'allow-all' | 'https-only' | 'redirect-to-https';
  allowedMethods: AllowedMethods;
  cachedMethods: CachedMethods;
  forwardedValues: ForwardedValues;
  minTTL: number;
  maxTTL: number;
  defaultTTL: number;
  compress: boolean;
  smoothStreaming?: boolean;
  defaultTTL?: number;
  maxTTL?: number;
  minTTL?: number;
}

export interface DefaultCacheBehavior extends CacheBehavior {
  trustedSigners?: {
    enabled: boolean;
    items: string[];
  };
}

export interface ForwardedValues {
  queryString: boolean;
  cookies: {
    forward: 'none' | 'all' | 'whitelist';
    whitelistedNames?: string[];
  };
  headers?: string[];
  queryStringCacheKeys?: string[];
}

export interface AllowedMethods {
  quantity: number;
  items: ('GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'OPTIONS' | 'DELETE')[];
  cachedMethods: {
    quantity: number;
    items: ('GET' | 'HEAD' | 'POST')[];
  };
}

export interface CachedMethods {
  quantity: number;
  items: ('GET' | 'HEAD')[];
}

export interface CustomErrorResponse {
  errorCode: number;
  responsePagePath: string;
  responseCode: number;
  errorCachingMinTTL: number;
}

export interface CDNRestrictions {
  geoRestriction: {
    restrictionType: 'none' | 'blacklist' | 'whitelist';
    items: string[];
  };
}

export interface ViewerCertificate {
  cloudFrontDefaultCertificate?: boolean;
  iamCertificateId?: string;
  acmCertificateArn?: string;
  sslSupportMethod?: 'sni-only' | 'vip' | 'static-ip';
  minimumProtocolVersion?: 'SSLv3' | 'TLSv1' | 'TLSv1_2016' | 'TLSv1.1_2016' | 'TLSv1.2_2018' | 'TLSv1.2_2019';
  certificate?: string;
  certificateSource?: 'cloudfront' | 'iam' | 'acm';
}

export class CDNManager {
  private cloudfront: CloudFrontClient;
  private s3: S3Client;
  private config: CDNConfig;

  constructor(config: CDNConfig, awsConfig?: any) {
    this.config = config;
    this.cloudfront = new CloudFrontClient({
      region: process.env.AWS_REGION || 'us-east-1',
      ...awsConfig,
    });
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      ...awsConfig,
    });
  }

  async createDistribution(): Promise<string> {
    const distributionConfig = {
      CallerReference: `guardrail-${Date.now()}`,
      Comment: 'guardrail CDN Distribution',
      DefaultRootObject: 'index.html',
      Origins: {
        Quantity: this.config.origins.length,
        Items: this.config.origins.map(origin => ({
          DomainName: origin.domainName,
          Id: origin.originId,
          OriginPath: origin.originPath || '',
          CustomHeaders: origin.customHeaders 
            ? { Quantity: Object.keys(origin.customHeaders).length, Items: Object.entries(origin.customHeaders).map(([key, value]) => ({ HeaderName: key, HeaderValue: value })) }
            : { Quantity: 0 },
          S3OriginConfig: origin.s3OriginConfig ? {
            OriginAccessIdentity: origin.s3OriginConfig.originAccessIdentity,
          } : undefined,
          CustomOriginConfig: origin.customOriginConfig ? {
            HTTPPort: origin.customOriginConfig.httpPort,
            HTTPSPort: origin.customOriginConfig.httpsPort,
            OriginProtocolPolicy: origin.customOriginConfig.originProtocolPolicy,
            OriginSslProtocols: {
              Quantity: origin.customOriginConfig.originSslProtocols.length,
              Items: origin.customOriginConfig.originSslProtocols,
            },
            OriginReadTimeout: origin.customOriginConfig.originReadTimeout,
            OriginKeepaliveTimeout: origin.customOriginConfig.originKeepaliveTimeout,
          } : undefined,
        })),
      },
      DefaultCacheBehavior: {
        TargetOriginId: this.config.defaultCacheBehavior.targetOriginId,
        ViewerProtocolPolicy: this.config.defaultCacheBehavior.viewerProtocolPolicy,
        TrustedSigners: this.config.defaultCacheBehavior.trustedSigners || {
          Enabled: false,
          Quantity: 0,
        },
        ForwardedValues: {
          QueryString: this.config.defaultCacheBehavior.forwardedValues.queryString,
          Cookies: this.config.defaultCacheBehavior.forwardedValues.cookies,
          Headers: this.config.defaultCacheBehavior.forwardedValues.headers
            ? { Quantity: this.config.defaultCacheBehavior.forwardedValues.headers.length, Items: this.config.defaultCacheBehavior.forwardedValues.headers }
            : { Quantity: 0 },
          QueryStringCacheKeys: this.config.defaultCacheBehavior.forwardedValues.queryStringCacheKeys
            ? { Quantity: this.config.defaultCacheBehavior.forwardedValues.queryStringCacheKeys.length, Items: this.config.defaultCacheBehavior.forwardedValues.queryStringCacheKeys }
            : { Quantity: 0 },
        },
        MinTTL: this.config.defaultCacheBehavior.minTTL,
        MaxTTL: this.config.defaultCacheBehavior.maxTTL,
        DefaultTTL: this.config.defaultCacheBehavior.defaultTTL,
        Compress: this.config.defaultCacheBehavior.compress,
        AllowedMethods: {
          Quantity: this.config.defaultCacheBehavior.allowedMethods.items.length,
          Items: this.config.defaultCacheBehavior.allowedMethods.items,
          CachedMethods: {
            Quantity: this.config.defaultCacheBehavior.allowedMethods.cachedMethods.items.length,
            Items: this.config.defaultCacheBehavior.allowedMethods.cachedMethods.items,
          },
        },
        SmoothStreaming: this.config.defaultCacheBehavior.smoothStreaming || false,
      },
      CacheBehaviors: this.config.cacheBehaviors.length > 0
        ? {
            Quantity: this.config.cacheBehaviors.length,
            Items: this.config.cacheBehaviors.map(behavior => ({
              PathPattern: behavior.pathPattern,
              TargetOriginId: behavior.targetOriginId,
              ViewerProtocolPolicy: behavior.viewerProtocolPolicy,
              ForwardedValues: {
                QueryString: behavior.forwardedValues.queryString,
                Cookies: behavior.forwardedValues.cookies,
              },
              MinTTL: behavior.minTTL,
              MaxTTL: behavior.maxTTL,
              DefaultTTL: behavior.defaultTTL,
              Compress: behavior.compress,
              AllowedMethods: {
                Quantity: behavior.allowedMethods.items.length,
                Items: behavior.allowedMethods.items,
                CachedMethods: {
                  Quantity: behavior.allowedMethods.cachedMethods.items.length,
                  Items: behavior.allowedMethods.cachedMethods.items,
                },
              },
            })),
          }
        : { Quantity: 0 },
      CustomErrorResponses: this.config.customErrorResponses
        ? {
            Quantity: this.config.customErrorResponses.length,
            Items: this.config.customErrorResponses.map(error => ({
              ErrorCode: error.errorCode,
              ResponsePagePath: error.responsePagePath,
              ResponseCode: error.responseCode,
              ErrorCachingMinTTL: error.errorCachingMinTTL,
            })),
          }
        : { Quantity: 0 },
      Restrictions: this.config.restrictions || {
        GeoRestriction: {
          RestrictionType: 'none',
          Quantity: 0,
        },
      },
      ViewerCertificate: this.config.viewerCertificate || {
        CloudFrontDefaultCertificate: true,
      },
      Enabled: true,
      HttpVersion: 'http2',
      IsIPV6Enabled: true,
    };

    const command = new CreateDistributionCommand({
      DistributionConfig: distributionConfig,
    });

    const response = await this.cloudfront.send(command);
    return response.Distribution?.Id || '';
  }

  async updateDistribution(): Promise<void> {
    if (!this.config.distributionId) {
      throw new Error('Distribution ID is required for updates');
    }

    const getDistributionCommand = {
      Id: this.config.distributionId,
    };

    const currentDistribution = await this.cloudfront.send(getDistributionCommand);
    
    if (!currentDistribution.Distribution?.DistributionConfig) {
      throw new Error('Failed to get current distribution configuration');
    }

    const updateCommand = new UpdateDistributionCommand({
      Id: this.config.distributionId,
      DistributionConfig: {
        ...currentDistribution.Distribution.DistributionConfig,
        CallerReference: `update-${Date.now()}`,
      },
      IfMatch: currentDistribution.ETag,
    });

    await this.cloudfront.send(updateCommand);
  }

  async invalidatePaths(paths: string[]): Promise<string> {
    if (!this.config.distributionId) {
      throw new Error('Distribution ID is required for invalidation');
    }

    const invalidationCommand = {
      DistributionId: this.config.distributionId,
      InvalidationBatch: {
        Paths: {
          Quantity: paths.length,
          Items: paths,
        },
        CallerReference: `invalidate-${Date.now()}`,
      },
    };

    const response = await this.cloudfront.send(invalidationCommand);
    return response.Invalidation?.Id || '';
  }

  async uploadToS3(bucket: string, key: string, content: string | Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
      CacheControl: this.getCacheControlForFile(key),
    });

    await this.s3.send(command);
  }

  private getCacheControlForFile(key: string): string {
    const extension = key.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'js':
      case 'css':
        return 'max-age=31536000, immutable';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
        return 'max-age=2592000, immutable';
      case 'html':
        return 'max-age=0, no-cache, must-revalidate';
      case 'json':
        return 'max-age=300, stale-while-revalidate=60';
      default:
        return 'max-age=86400';
    }
  }

  async createBucket(bucket: string): Promise<void> {
    const command = new CreateBucketCommand({
      Bucket: bucket,
      ACL: 'private',
    });

    await this.s3.send(command);
  }

  async getDistributionMetrics(): Promise<{
    requests: number;
    bytesTransferred: number;
    errorRate: number;
    cacheHitRate: number;
  }> {
    return {
      requests: 0,
      bytesTransferred: 0,
      errorRate: 0,
      cacheHitRate: 0,
    };
  }

  createStaticAssetOptimizer() {
    return {
      optimizeImages: async (imageBuffer: Buffer): Promise<Buffer> => {
        return imageBuffer;
      },
      
      minifyCSS: (css: string): string => {
        return css
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\s+/g, ' ')
          .replace(/;\s*}/g, '}')
          .trim();
      },
      
      minifyJS: (js: string): string => {
        return js
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '')
          .replace(/\s+/g, ' ')
          .trim();
      },
      
      generateCriticalCSS: (html: string): string => {
        return '';
      },
    };
  }

  async deployStaticAssets(localPath: string, bucket: string, basePath: string = ''): Promise<void> {
    const { readdirSync, statSync } = await import('fs');
    const { join } = await import('path');
    
    const uploadFile = async (filePath: string, relativePath: string) => {
      const content = readFileSync(filePath);
      const contentType = this.getContentType(filePath);
      const key = join(basePath, relativePath).replace(/\\/g, '/');
      
      await this.uploadToS3(bucket, key, content, contentType);
    };

    const uploadDirectory = async (dirPath: string, relativePath: string = '') => {
      const files = readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = join(dirPath, file);
        const fileRelativePath = join(relativePath, file);
        const stats = statSync(filePath);
        
        if (stats.isDirectory()) {
          await uploadDirectory(filePath, fileRelativePath);
        } else {
          await uploadFile(filePath, fileRelativePath);
        }
      }
    };

    await uploadDirectory(localPath);
    
    const invalidationPaths = [
      `/${basePath}/*`,
    ];
    
    await this.invalidatePaths(invalidationPaths);
  }

  private getContentType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      txt: 'text/plain',
      pdf: 'application/pdf',
      zip: 'application/zip',
    };
    
    return mimeTypes[extension || ''] || 'application/octet-stream';
  }
}

export function createCDNConfig(config: Partial<CDNConfig>): CDNConfig {
  return {
    domain: config.domain || 'cdn.guardrailai.dev',
    origins: config.origins || [{
      domainName: `${process.env.AWS_S3_BUCKET}.s3.amazonaws.com`,
      originId: 'S3-guardrail',
      customOriginConfig: {
        httpPort: 80,
        httpsPort: 443,
        originProtocolPolicy: 'https-only',
        originSslProtocols: ['TLSv1.2'],
      },
    }],
    cacheBehaviors: config.cacheBehaviors || [],
    defaultCacheBehavior: config.defaultCacheBehavior || {
      pathPattern: '*',
      targetOriginId: 'S3-guardrail',
      viewerProtocolPolicy: 'redirect-to-https',
      allowedMethods: {
        quantity: 2,
        items: ['GET', 'HEAD'],
        cachedMethods: {
          quantity: 2,
          items: ['GET', 'HEAD'],
        },
      },
      cachedMethods: {
        quantity: 2,
        items: ['GET', 'HEAD'],
      },
      forwardedValues: {
        queryString: false,
        cookies: {
          forward: 'none',
        },
      },
      minTTL: 0,
      maxTTL: 31536000,
      defaultTTL: 86400,
      compress: true,
    },
    customErrorResponses: config.customErrorResponses || [
      {
        errorCode: 404,
        responsePagePath: '/error.html',
        responseCode: 404,
        errorCachingMinTTL: 300,
      },
    ],
    restrictions: config.restrictions,
    viewerCertificate: config.viewerCertificate || {
      cloudFrontDefaultCertificate: true,
    },
  };
}
