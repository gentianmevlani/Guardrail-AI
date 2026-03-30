/**
 * Comprehensive File Storage Service
 * Handles file uploads, validation, processing, and cloud storage
 */

import { randomUUID } from "crypto";
import { FastifyRequest } from "fastify";
import { createWriteStream } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { logger } from "../logger";
import { ValidationError } from "../middleware/enhanced-error-handler";
import { safeJoin, sanitizeFilename } from "../utils/path-safety";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// File storage configuration
export interface FileStorageConfig {
  provider: "aws-s3" | "google-cloud" | "azure" | "local";
  aws?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket: string;
  };
  googleCloud?: {
    keyFilename: string;
    bucket: string;
  };
  azure?: {
    connectionString: string;
    container: string;
  };
  local?: {
    uploadPath: string;
    baseUrl: string;
  };
  validation: {
    maxFileSize: number; // bytes
    maxFileCount: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
    scanForMalware: boolean;
  };
  processing: {
    generateThumbnails: boolean;
    thumbnailSizes: Array<{ width: number; height: number; suffix: string }>;
    compressImages: boolean;
    imageQuality: number;
  };
  security: {
    virusScanner: "clamav" | "virustotal" | "none";
    scanTimeout: number;
    quarantineInfected: boolean;
  };
}

// File metadata interface
export interface FileMetadata {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  path: string;
  url: string;
  checksum: string;
  isPublic: boolean;
  metadata?: Record<string, unknown>;
  thumbnails?: Array<{
    url: string;
    width: number;
    height: number;
    size: number;
  }>;
}

// Upload result interface
export interface UploadResult {
  success: boolean;
  files: FileMetadata[];
  errors: Array<{
    filename: string;
    error: string;
  }>;
  totalSize: number;
  uploadTime: number;
}

// Default configuration
const defaultConfig: FileStorageConfig = {
  provider: "local",
  validation: {
    maxFileSize: 25 * 1024 * 1024, // 25MB
    maxFileCount: 10,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/json",
      "application/xml",
      "application/zip",
      "application/x-zip-compressed",
    ],
    allowedExtensions: [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".pdf",
      ".txt",
      ".csv",
      ".json",
      ".xml",
      ".zip",
    ],
    scanForMalware: true,
  },
  processing: {
    generateThumbnails: true,
    thumbnailSizes: [
      { width: 150, height: 150, suffix: "thumb" },
      { width: 300, height: 300, suffix: "medium" },
      { width: 800, height: 600, suffix: "large" },
    ],
    compressImages: true,
    imageQuality: 85,
  },
  security: {
    virusScanner: "none",
    scanTimeout: 30000,
    quarantineInfected: true,
  },
};

// File storage service
export class FileStorageService {
  private config: FileStorageConfig;
  private storageProvider: StorageProvider;

  constructor(config: Partial<FileStorageConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.storageProvider = this.createStorageProvider();
  }

  private createStorageProvider(): StorageProvider {
    switch (this.config.provider) {
      case "aws-s3":
        if (!this.config.aws) {
          logger.warn("S3 provider selected but configuration missing. Falling back to local storage.");
          return new LocalStorageProvider(this.config.local!);
        }
        try {
          return new S3StorageProvider(this.config.aws);
        } catch (error: unknown) {
          logger.error({ error: toErrorMessage(error) }, "Failed to initialize S3 provider. Falling back to local storage.");
          return new LocalStorageProvider(this.config.local!);
        }
      case "google-cloud":
        if (!this.config.googleCloud) {
          logger.warn("GCS provider selected but configuration missing. Falling back to local storage.");
          return new LocalStorageProvider(this.config.local!);
        }
        try {
          return new GoogleCloudStorageProvider(this.config.googleCloud);
        } catch (error: unknown) {
          logger.error({ error: toErrorMessage(error) }, "Failed to initialize GCS provider. Falling back to local storage.");
          return new LocalStorageProvider(this.config.local!);
        }
      case "azure":
        if (!this.config.azure) {
          logger.warn("Azure provider selected but configuration missing. Falling back to local storage.");
          return new LocalStorageProvider(this.config.local!);
        }
        try {
          return new AzureStorageProvider(this.config.azure);
        } catch (error: unknown) {
          logger.error({ error: toErrorMessage(error) }, "Failed to initialize Azure provider. Falling back to local storage.");
          return new LocalStorageProvider(this.config.local!);
        }
      case "local":
      default:
        return new LocalStorageProvider(this.config.local!);
    }
  }

  // Upload files from multipart request
  async uploadFiles(
    request: FastifyRequest,
    options: {
      isPublic?: boolean;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const result: UploadResult = {
      success: true,
      files: [],
      errors: [],
      totalSize: 0,
      uploadTime: 0,
    };

    try {
      const files = await (request as any).files();
      const fileArray = Array.isArray(files) ? files : [files];

      if (fileArray.length > this.config.validation.maxFileCount) {
        throw new ValidationError(
          `Too many files. Maximum allowed: ${this.config.validation.maxFileCount}`,
        );
      }

      for await (const file of fileArray) {
        try {
          const metadata = await this.processFile(file, options, request);
          result.files.push(metadata);
          result.totalSize += metadata.size;
        } catch (error) {
          result.errors.push({
            filename: file.filename,
            error: error instanceof Error ? toErrorMessage(error) : "Unknown error",
          });
        }
      }

      result.uploadTime = Date.now() - startTime;
      result.success = result.errors.length === 0;

      logger.info(
        {
          fileCount: result.files.length,
          errorCount: result.errors.length,
          totalSize: result.totalSize,
          uploadTime: result.uploadTime,
        },
        "File upload completed",
      );
    } catch (error) {
      result.success = false;
      result.errors.push({
        filename: "unknown",
        error: error instanceof Error ? toErrorMessage(error) : "Upload failed",
      });
    }

    return result;
  }

  // Process individual file
  private async processFile(
    file: any,
    options: { isPublic?: boolean; metadata?: Record<string, unknown> },
    request: FastifyRequest,
  ): Promise<FileMetadata> {
    // Generate unique filename
    const fileId = randomUUID();
    const extension = path.extname(file.filename).toLowerCase();
    const filename = `${fileId}${extension}`;

    // Validate file
    await this.validateFile(file, extension);

    // Calculate checksum
    const checksum = await this.calculateChecksum(file.file);

    // Read file buffer
    const buffer = await this.fileToBuffer(file.file);

    // Scan for malware if enabled
    if (this.config.validation.scanForMalware) {
      await this.scanForMalware(buffer, filename);
    }

    // Process file (thumbnails, compression, etc.)
    const processedFiles = await this.processFileContent(
      buffer,
      filename,
      file.mimetype,
    );

    // Upload to storage
    const uploadUrl = await this.storageProvider.uploadFile(
      filename,
      buffer,
      file.mimetype,
      options.isPublic || false,
    );

    // Upload thumbnails if generated
    const thumbnails: FileMetadata["thumbnails"] = [];
    for (const thumbnail of processedFiles.thumbnails) {
      const thumbnailUrl = await this.storageProvider.uploadFile(
        thumbnail.filename,
        thumbnail.buffer,
        "image/jpeg",
        options.isPublic || false,
      );

      thumbnails.push({
        url: thumbnailUrl,
        width: thumbnail.width,
        height: thumbnail.height,
        size: thumbnail.buffer.length,
      });
    }

    // Create metadata
    const metadata: FileMetadata = {
      id: fileId,
      originalName: file.filename,
      filename,
      mimetype: file.mimetype,
      size: buffer.length,
      uploadedBy: (request as any).user?.id || "anonymous",
      uploadedAt: new Date(),
      path: filename,
      url: uploadUrl,
      checksum,
      isPublic: options.isPublic || false,
      metadata: options.metadata,
      thumbnails: thumbnails.length > 0 ? thumbnails : undefined,
    };

    // Save metadata to database or file system
    await this.saveFileMetadata(metadata);

    logger.debug(
      {
        fileId,
        originalName: file.filename,
        size: metadata.size,
        mimetype: file.mimetype,
        url: uploadUrl,
      },
      "File processed successfully",
    );

    return metadata;
  }

  // Validate file
  private async validateFile(file: any, extension: string): Promise<void> {
    // Check file size
    if (file.file.bytesRead > this.config.validation.maxFileSize) {
      throw new ValidationError(
        `File too large. Maximum size: ${this.formatBytes(this.config.validation.maxFileSize)}`,
      );
    }

    // Check MIME type
    if (!this.config.validation.allowedMimeTypes.includes(file.mimetype)) {
      throw new ValidationError(`MIME type not allowed: ${file.mimetype}`);
    }

    // Check file extension
    if (!this.config.validation.allowedExtensions.includes(extension)) {
      throw new ValidationError(`File extension not allowed: ${extension}`);
    }

    // Validate file signature (magic bytes)
    const buffer = await this.fileToBuffer(file.file);
    if (!this.validateFileSignature(buffer, file.mimetype)) {
      throw new ValidationError("File signature does not match declared type");
    }
  }

  // Validate file signature
  private validateFileSignature(buffer: Buffer, mimetype: string): boolean {
    const signatures: Record<string, number[]> = {
      "image/jpeg": [0xff, 0xd8, 0xff],
      "image/png": [0x89, 0x50, 0x4e, 0x47],
      "image/gif": [0x47, 0x49, 0x46],
      "application/pdf": [0x25, 0x50, 0x44, 0x46],
      "application/zip": [0x50, 0x4b, 0x03, 0x04],
    };

    const signature = signatures[mimetype];
    if (!signature) return true; // No signature check for unknown types

    return signature.every((byte, index) => buffer[index] === byte);
  }

  // Calculate file checksum
  private async calculateChecksum(fileStream: any): Promise<string> {
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256");

    for await (const chunk of fileStream) {
      hash.update(chunk);
    }

    return hash.digest("hex");
  }

  // Convert file to buffer
  private async fileToBuffer(fileStream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  // Scan for malware
  private async scanForMalware(
    buffer: Buffer,
    filename: string,
  ): Promise<void> {
    if (this.config.security.virusScanner === "none") {
      return;
    }

    logger.debug(
      { filename, scanner: this.config.security.virusScanner },
      "Scanning file for malware",
    );

    // Perform malware scanning using ClamAV, VirusTotal, or heuristic methods
    const isClean = await this.performMalwareScan(buffer);

    if (!isClean) {
      if (this.config.security.quarantineInfected) {
        await this.quarantineFile(buffer, filename);
      }
      throw new ValidationError("File contains malicious content");
    }
  }

  // Perform malware scan with multiple detection methods
  private async performMalwareScan(buffer: Buffer): Promise<boolean> {
    try {
      // Method 1: Try ClamAV if available (best option)
      if (this.config.security.virusScanner === 'clamav') {
        try {
          const isClean = await this.scanWithClamAV(buffer);
          if (isClean !== null) {
            return isClean;
          }
        } catch (clamavError: any) {
          logger.warn({ error: clamavError.message }, 'ClamAV scan failed, falling back to heuristics');
        }
      }

      // Method 2: Try VirusTotal API if configured
      if (this.config.security.virusScanner === 'virustotal') {
        try {
          const isClean = await this.scanWithVirusTotal(buffer);
          if (isClean !== null) {
            return isClean;
          }
        } catch (vtError: any) {
          logger.warn({ error: vtError.message }, 'VirusTotal scan failed, falling back to heuristics');
        }
      }

      // Method 3: Enhanced heuristic scanning (fallback)
      return await this.performHeuristicScan(buffer);
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, 'Malware scan failed');
      // Fail open for now, but log the error
      return true;
    }
  }

  // Scan with ClamAV (if installed)
  private async scanWithClamAV(buffer: Buffer): Promise<boolean | null> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const { writeFileSync, unlinkSync } = require('fs');
      const { randomUUID } = require('crypto');
      const path = require('path');

      // Write buffer to temporary file
      const tempFile = path.join(process.cwd(), 'temp', `scan-${randomUUID()}`);
      writeFileSync(tempFile, buffer);

      try {
        // Run ClamAV scan
        const { stdout } = await execAsync(`clamdscan --no-summary "${tempFile}"`, { timeout: this.config.security.scanTimeout });
        
        // ClamAV returns 0 if clean, 1 if infected
        const isClean = !stdout.includes('FOUND') && !stdout.includes('Infected');
        
        // Clean up temp file
        unlinkSync(tempFile);
        
        return isClean;
      } catch (execError: any) {
        // Clean up temp file even on error
        try {
          unlinkSync(tempFile);
        } catch (cleanupError) {
          logger.warn({ tempFile, error: cleanupError }, "Failed to cleanup temp file");
        }
        
        // If ClamAV is not installed, return null to fall back
        if (execError.code === 127 || execError.message.includes('not found')) {
          return null;
        }
        throw execError;
      }
    } catch (error: unknown) {
      // ClamAV not available or error
      return null;
    }
  }

  // Scan with VirusTotal API
  private async scanWithVirusTotal(buffer: Buffer): Promise<boolean | null> {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) {
      return null;
    }

    try {
      // VirusTotal requires file hash for scanning
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');

      // Check hash first (free, no quota)
      const hashResponse = await fetch(`https://www.virustotal.com/vtapi/v2/file/report?apikey=${apiKey}&resource=${hash}`);
      if (hashResponse.ok) {
        const hashData = (await hashResponse.json()) as Record<string, unknown>;
        if (hashData['response_code'] === 1) {
          // File already scanned, return result
          const positives =
            typeof hashData['positives'] === 'number' ? hashData['positives'] : 0;
          return positives === 0;
        }
      }

      // If not found, would need to upload file (requires paid API)
      // For now, return null to fall back to heuristics
      logger.debug('VirusTotal: File not in database, would require upload (paid feature)');
      return null;
    } catch (error: unknown) {
      logger.warn({ error: toErrorMessage(error) }, 'VirusTotal API error');
      return null;
    }
  }

  // Enhanced heuristic scanning
  private async performHeuristicScan(buffer: Buffer): Promise<boolean> {
    // Enhanced suspicious patterns
    const suspiciousPatterns = [
      // Code execution patterns
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /shell_exec\s*\(/gi,
      /passthru\s*\(/gi,
      /proc_open\s*\(/gi,
      /popen\s*\(/gi,
      
      // Script injection
      /<script.*?>.*?<\/script>/gi,
      /javascript:/gi,
      /onerror\s*=/gi,
      /onload\s*=/gi,
      
      // Suspicious file operations
      /\.\.\/\.\.\//g, // Path traversal
      /\/etc\/passwd/gi,
      /\/etc\/shadow/gi,
      /C:\\Windows\\System32/gi,
      
      // Network suspicious patterns
      /curl_exec\s*\(/gi,
      /file_get_contents\s*\(\s*['"]http/gi,
      /fsockopen\s*\(/gi,
      
      // Base64 encoded suspicious content
      /base64_decode\s*\(/gi,
      /gzinflate\s*\(/gi,
      /str_rot13\s*\(/gi,
    ];

    // Check first 10KB of file for text-based patterns
    const content = buffer.toString("utf8", 0, Math.min(10240, buffer.length));
    
    // Check for suspicious patterns
    const foundPatterns = suspiciousPatterns.filter((pattern) => pattern.test(content));
    
    if (foundPatterns.length > 0) {
      logger.warn({ 
        patternsFound: foundPatterns.length,
        fileSize: buffer.length 
      }, 'Suspicious patterns detected in file');
      return false;
    }

    // Check file magic numbers for known malicious file types
    const magicNumbers = buffer.slice(0, 16);
    const suspiciousMagicNumbers = [
      Buffer.from([0x4D, 0x5A]), // PE executable
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
    ];

    for (const magic of suspiciousMagicNumbers) {
      if (magicNumbers.slice(0, magic.length).equals(magic)) {
        logger.warn('Executable file type detected');
        return false;
      }
    }

    return true;
  }

  // Quarantine infected file
  private async quarantineFile(
    buffer: Buffer,
    filename: string,
  ): Promise<void> {
    // SECURITY: Sanitize filename to prevent path traversal attacks
    // An attacker could use filename = "../../../etc/passwd" to write outside quarantine
    const sanitizedFilename = sanitizeFilename(filename, { logAttempts: true });
    const timestampedName = `${Date.now()}-${sanitizedFilename}`;

    // Use safeJoin to ensure the path stays within quarantine directory
    const quarantineDir = path.join(process.cwd(), "quarantine");
    const quarantinePath = safeJoin(quarantineDir, timestampedName);

    try {
      // Ensure quarantine directory exists
      await fs.mkdir(quarantineDir, { recursive: true });

      await pipeline(
        Readable.from([buffer]),
        createWriteStream(quarantinePath),
      );

      logger.warn(
        {
          originalFilename: filename,
          sanitizedFilename,
          quarantinePath,
        },
        "File quarantined",
      );
    } catch (error) {
      logger.error(
        { error, filename: sanitizedFilename },
        "Failed to quarantine file",
      );
    }
  }

  // Process file content (thumbnails, compression)
  private async processFileContent(
    buffer: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<{
    thumbnails: Array<{
      filename: string;
      buffer: Buffer;
      width: number;
      height: number;
    }>;
  }> {
    const result: {
      thumbnails: Array<{
        filename: string;
        buffer: Buffer;
        width: number;
        height: number;
      }>;
    } = { thumbnails: [] };

    if (!mimetype.startsWith("image/")) {
      return result;
    }

    // Generate thumbnails if enabled
    if (this.config.processing.generateThumbnails) {
      for (const size of this.config.processing.thumbnailSizes) {
        try {
          const thumbnailBuffer = await this.generateThumbnail(
            buffer,
            size.width,
            size.height,
          );
          const thumbnailFilename = `${path.basename(filename, path.extname(filename))}_${size.suffix}.jpg`;

          result.thumbnails.push({
            filename: thumbnailFilename,
            buffer: thumbnailBuffer,
            width: size.width,
            height: size.height,
          });
        } catch (error) {
          logger.warn(
            { error, filename, size },
            "Failed to generate thumbnail",
          );
        }
      }
    }

    return result;
  }

  // Generate thumbnail using sharp or fallback to basic resize
  private async generateThumbnail(
    buffer: Buffer,
    width: number,
    height: number,
  ): Promise<Buffer> {
    try {
      // Try to use sharp if available (better quality and performance)
      try {
        const sharp = require('sharp');
        const thumbnail = await sharp(buffer)
          .resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();
        
        logger.debug({ width, height, originalSize: buffer.length, thumbnailSize: thumbnail.length }, "Thumbnail generated with sharp");
        return thumbnail;
      } catch (sharpError: any) {
        // If sharp is not available, try jimp
        try {
          const Jimp = require('jimp');
          const image = await Jimp.read(buffer);
          image.cover(width, height);
          const thumbnailBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
          
          logger.debug({ width, height }, "Thumbnail generated with jimp");
          return thumbnailBuffer;
        } catch (jimpError: any) {
          // If neither library is available, return a scaled-down version
          // This is a basic fallback - in production, sharp should be installed
          logger.warn({ width, height, error: jimpError.message }, "Image processing libraries not available, using basic fallback");
          
          // Basic fallback: return original buffer with a warning
          // In production, ensure sharp is installed: npm install sharp
          return buffer;
        }
      }
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), width, height }, "Failed to generate thumbnail");
      // Return original buffer as fallback
      return buffer;
    }
  }

  // Get file by ID
  async getFile(fileId: string): Promise<FileMetadata | null> {
    try {
      // Try to use Prisma if available
      try {
        const { prisma } = require('@guardrail/database');
        const fileRecord = await prisma.fileMetadata.findUnique({
          where: { id: fileId },
        });

        if (fileRecord) {
          return {
            id: fileRecord.id,
            originalName: fileRecord.originalName,
            filename: fileRecord.filename,
            mimetype: fileRecord.mimetype,
            size: fileRecord.size,
            uploadedBy: fileRecord.uploadedBy,
            uploadedAt: fileRecord.uploadedAt,
            path: fileRecord.path || '',
            url: fileRecord.url || '',
            checksum: fileRecord.checksum || '',
            isPublic: fileRecord.isPublic || false,
            metadata: fileRecord.metadata as Record<string, unknown> || {},
            thumbnails: fileRecord.thumbnails as Array<{
              url: string;
              width: number;
              height: number;
              size: number;
            }> || [],
          };
        }
      } catch (prismaError: any) {
        // If Prisma is not available or table doesn't exist, use file-based storage
        logger.debug({ error: prismaError.message }, "Prisma not available, using file-based metadata storage");
      }

      // Fallback: Try to read from file system metadata cache
      const metadataPath = path.join(process.cwd(), '.file-metadata', `${fileId}.json`);
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        return metadata as FileMetadata;
      } catch (fileError: any) {
        // File doesn't exist
        logger.debug({ fileId }, "File metadata not found");
        return null;
      }
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), fileId }, "Failed to get file");
      return null;
    }
  }

  // Save file metadata to database or file system
  private async saveFileMetadata(metadata: FileMetadata): Promise<void> {
    try {
      // Try to use Prisma if available
      try {
        const { prisma } = require('@guardrail/database');
        await prisma.fileMetadata.upsert({
          where: { id: metadata.id },
          create: {
            id: metadata.id,
            originalName: metadata.originalName,
            filename: metadata.filename,
            mimetype: metadata.mimetype,
            size: metadata.size,
            uploadedBy: metadata.uploadedBy,
            uploadedAt: metadata.uploadedAt,
            path: metadata.path,
            url: metadata.url,
            checksum: metadata.checksum,
            isPublic: metadata.isPublic,
            metadata: metadata.metadata || {},
            thumbnails: metadata.thumbnails || [],
          },
          update: {
            url: metadata.url,
            path: metadata.path,
            thumbnails: metadata.thumbnails || [],
            metadata: metadata.metadata || {},
          },
        });
        logger.debug({ fileId: metadata.id }, "File metadata saved to database");
        return;
      } catch (prismaError: any) {
        // If Prisma is not available or table doesn't exist, use file-based storage
        logger.debug({ error: prismaError.message }, "Prisma not available, using file-based metadata storage");
      }

      // Fallback: Save to file system
      const metadataDir = path.join(process.cwd(), '.file-metadata');
      await fs.mkdir(metadataDir, { recursive: true });
      const metadataPath = path.join(metadataDir, `${metadata.id}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      logger.debug({ fileId: metadata.id }, "File metadata saved to file system");
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), fileId: metadata.id }, "Failed to save file metadata");
      // Don't throw - metadata storage failure shouldn't break file upload
    }
  }

  // Delete file metadata from database or file system
  private async deleteFileMetadata(fileId: string): Promise<void> {
    try {
      // Try to use Prisma if available
      try {
        const { prisma } = require('@guardrail/database');
        await prisma.fileMetadata.delete({
          where: { id: fileId },
        });
        logger.debug({ fileId }, "File metadata deleted from database");
        return;
      } catch (prismaError: any) {
        // If Prisma is not available, use file-based storage
        logger.debug({ error: prismaError.message }, "Prisma not available, using file-based metadata storage");
      }

      // Fallback: Delete from file system
      const metadataPath = path.join(process.cwd(), '.file-metadata', `${fileId}.json`);
      try {
        await fs.unlink(metadataPath);
        logger.debug({ fileId }, "File metadata deleted from file system");
      } catch (fileError: any) {
        // File might not exist, ignore error
        logger.debug({ fileId }, "File metadata not found in file system");
      }
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), fileId }, "Failed to delete file metadata");
      // Don't throw - metadata deletion failure shouldn't break file deletion
    }
  }

  // Delete file
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const file = await this.getFile(fileId);
      if (!file) {
        return false;
      }

      // Delete from storage
      await this.storageProvider.deleteFile(file.filename);

      // Delete thumbnails
      if (file.thumbnails) {
        for (const thumbnail of file.thumbnails) {
          const thumbnailFilename = path.basename(thumbnail.url);
          await this.storageProvider.deleteFile(thumbnailFilename);
        }
      }

      // Delete from database or file system
      await this.deleteFileMetadata(fileId);
      
      logger.info({ fileId, filename: file.filename }, "File deleted");
      return true;
    } catch (error) {
      logger.error({ error, fileId }, "Failed to delete file");
      return false;
    }
  }

  // Generate signed URL for private files
  async generateSignedUrl(
    fileId: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const file = await this.getFile(fileId);
      if (!file) {
        throw new Error("File not found");
      }

      return this.storageProvider.generateSignedUrl(file.filename, expiresIn);
    } catch (error) {
      logger.error({ error, fileId }, "Failed to generate signed URL");
      throw error;
    }
  }

  // Utility method to format bytes
  private formatBytes(bytes: number): string {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  }
}

// Storage provider interface
interface StorageProvider {
  uploadFile(
    filename: string,
    buffer: Buffer,
    mimetype: string,
    isPublic: boolean,
  ): Promise<string>;
  deleteFile(filename: string): Promise<void>;
  generateSignedUrl(filename: string, expiresIn: number): Promise<string>;
}

// Local storage provider
class LocalStorageProvider implements StorageProvider {
  constructor(private config: FileStorageConfig["local"]) {}

  async uploadFile(
    filename: string,
    buffer: Buffer,
    mimetype: string,
    isPublic: boolean,
  ): Promise<string> {
    const uploadPath = this.config?.uploadPath || "./uploads";
    // SECURITY: Use safeJoin to prevent path traversal attacks
    const sanitizedFilename = sanitizeFilename(filename, { logAttempts: true });
    const filePath = safeJoin(uploadPath, sanitizedFilename);

    // Ensure upload directory exists
    await fs.mkdir(uploadPath, { recursive: true });

    await pipeline(Readable.from([buffer]), createWriteStream(filePath));

    const baseUrl = this.config?.baseUrl;
    if (!baseUrl) {
      throw new Error(
        "UPLOAD_BASE_URL environment variable is required for file storage. Set UPLOAD_BASE_URL in your environment configuration.",
      );
    }
    return `${baseUrl}/${encodeURIComponent(sanitizedFilename)}`;
  }

  async deleteFile(filename: string): Promise<void> {
    const uploadPath = this.config?.uploadPath || "./uploads";
    // SECURITY: Sanitize filename to prevent path traversal on delete
    const sanitizedFilename = sanitizeFilename(filename, { logAttempts: true });
    const filePath = safeJoin(uploadPath, sanitizedFilename);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, ignore error
    }
  }

  async generateSignedUrl(
    filename: string,
    expiresIn: number,
  ): Promise<string> {
    const baseUrl = this.config?.baseUrl;
    if (!baseUrl) {
      throw new Error(
        "UPLOAD_BASE_URL environment variable is required for file storage. Set UPLOAD_BASE_URL in your environment configuration.",
      );
    }
    // SECURITY: Sanitize filename to prevent URL manipulation
    const sanitizedFilename = sanitizeFilename(filename, {
      logAttempts: false,
    });
    return `${baseUrl}/${encodeURIComponent(sanitizedFilename)}?expires=${Date.now() + expiresIn * 1000}`;
  }
}

// S3 storage provider
class S3StorageProvider implements StorageProvider {
  private s3Client: any;
  private bucket: string;
  private region: string;

  constructor(private config: FileStorageConfig["aws"]) {
    if (!config) {
      throw new Error("S3 configuration is required");
    }

    // Validate required config
    if (!config.accessKeyId || !config.secretAccessKey || !config.bucket || !config.region) {
      throw new Error("S3 configuration incomplete. Required: accessKeyId, secretAccessKey, bucket, region");
    }

    this.bucket = config.bucket;
    this.region = config.region;

    // Dynamically import AWS SDK
    try {
      const { S3Client } = require("@aws-sdk/client-s3");
      const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

      this.s3Client = new S3Client({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });

      // Store getSignedUrl for later use
      (this as any).getSignedUrl = getSignedUrl;
    } catch (error) {
      logger.error({ error }, "Failed to initialize S3 client. Make sure @aws-sdk/client-s3 is installed.");
      throw new Error("S3 client initialization failed. Check AWS SDK installation.");
    }
  }

  async uploadFile(
    filename: string,
    buffer: Buffer,
    mimetype: string,
    isPublic: boolean,
  ): Promise<string> {
    try {
      const { PutObjectCommand } = require("@aws-sdk/client-s3");
      
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: filename,
        Body: buffer,
        ContentType: mimetype,
        ...(isPublic ? { ACL: "public-read" } : {}),
      });

      await this.s3Client.send(command);

      logger.info({ filename, bucket: this.bucket, size: buffer.length, isPublic }, "File uploaded to S3");

      if (isPublic) {
        return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURIComponent(filename)}`;
      } else {
        return filename;
      }
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), filename, bucket: this.bucket }, "S3 upload failed");
      throw new Error(`S3 upload failed: ${toErrorMessage(error)}`);
    }
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
      
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: filename,
      });

      await this.s3Client.send(command);
      logger.debug({ filename, bucket: this.bucket }, "S3 file deleted");
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), filename, bucket: this.bucket }, "S3 delete failed");
    }
  }

  async generateSignedUrl(
    filename: string,
    expiresIn: number,
  ): Promise<string> {
    try {
      const { GetObjectCommand } = require("@aws-sdk/client-s3");
      const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: filename,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), filename, bucket: this.bucket }, "S3 signed URL generation failed");
      throw new Error(`Failed to generate signed URL: ${toErrorMessage(error)}`);
    }
  }
}

// Google Cloud Storage provider
class GoogleCloudStorageProvider implements StorageProvider {
  private storage: any;
  private bucket: any;
  private bucketName: string;

  constructor(private config: FileStorageConfig["googleCloud"]) {
    if (!config) {
      throw new Error("GCS configuration is required");
    }
    this.bucketName = config.bucket;

    try {
      const { Storage } = require("@google-cloud/storage");
      this.storage = new Storage({
        keyFilename: config.keyFilename,
      });
      this.bucket = this.storage.bucket(this.bucketName);
    } catch (error) {
      logger.error({ error }, "Failed to initialize GCS client");
      throw new Error("GCS client initialization failed");
    }
  }

  async uploadFile(
    filename: string,
    buffer: Buffer,
    mimetype: string,
    isPublic: boolean,
  ): Promise<string> {
    try {
      const file = this.bucket.file(filename);
      await file.save(buffer, {
        contentType: mimetype,
        public: isPublic,
      });

      logger.info({ filename, bucket: this.bucketName, isPublic }, "File uploaded to GCS");

      if (isPublic) {
        return `https://storage.googleapis.com/${this.bucketName}/${filename}`;
      }
      return filename;
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), filename, bucket: this.bucketName }, "GCS upload failed");
      throw new Error(`GCS upload failed: ${toErrorMessage(error)}`);
    }
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      await this.bucket.file(filename).delete();
      logger.debug({ filename, bucket: this.bucketName }, "GCS file deleted");
    } catch (error: unknown) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "number"
          ? (error as { code: number }).code
          : undefined;
      if (code !== 404) {
        logger.error({ error: toErrorMessage(error), filename, bucket: this.bucketName }, "GCS delete failed");
      }
    }
  }

  async generateSignedUrl(
    filename: string,
    expiresIn: number,
  ): Promise<string> {
    try {
      const [url] = await this.bucket.file(filename).getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + expiresIn * 1000,
      });
      return url;
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), filename, bucket: this.bucketName }, "GCS signed URL generation failed");
      throw new Error(`Failed to generate signed URL: ${toErrorMessage(error)}`);
    }
  }
}

// Azure Storage provider
class AzureStorageProvider implements StorageProvider {
  private blobServiceClient: any;
  private containerClient: any;
  private containerName: string;

  constructor(private config: FileStorageConfig["azure"]) {
    if (!config) {
      throw new Error("Azure configuration is required");
    }
    this.containerName = config.container;

    try {
      const { BlobServiceClient } = require("@azure/storage-blob");
      this.blobServiceClient = BlobServiceClient.fromConnectionString(config.connectionString);
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    } catch (error) {
      logger.error({ error }, "Failed to initialize Azure client");
      throw new Error("Azure client initialization failed");
    }
  }

  async uploadFile(
    filename: string,
    buffer: Buffer,
    mimetype: string,
    isPublic: boolean,
  ): Promise<string> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(filename);
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: { blobContentType: mimetype },
      });

      if (isPublic) {
        // Set access tier if needed, but usually container level access is enough for public
      }

      logger.info({ filename, container: this.containerName, isPublic }, "File uploaded to Azure");
      return blockBlobClient.url;
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), filename, container: this.containerName }, "Azure upload failed");
      throw new Error(`Azure upload failed: ${toErrorMessage(error)}`);
    }
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(filename);
      await blockBlobClient.delete();
      logger.debug({ filename, container: this.containerName }, "Azure file deleted");
    } catch (error: unknown) {
      const statusCode =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof (error as { statusCode: unknown }).statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : undefined;
      if (statusCode !== 404) {
        logger.error({ error: toErrorMessage(error), filename, container: this.containerName }, "Azure delete failed");
      }
    }
  }

  async generateSignedUrl(
    filename: string,
    expiresIn: number,
  ): Promise<string> {
    try {
      const { generateBlobSASQueryParameters, BlobSASPermissions } = require("@azure/storage-blob");
      
      // We need credential to sign, which is available on service client
      // This part assumes shared key credential which is standard for connection string
      const sasOptions = {
        containerName: this.containerName,
        blobName: filename,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: new Date(Date.now() + expiresIn * 1000),
      };

      const sasToken = generateBlobSASQueryParameters(
        sasOptions,
        this.blobServiceClient.credential
      ).toString();

      return `${this.containerClient.getBlockBlobClient(filename).url}?${sasToken}`;
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), filename, container: this.containerName }, "Azure signed URL generation failed");
      throw new Error(`Failed to generate signed URL: ${toErrorMessage(error)}`);
    }
  }
}

// Export singleton - initialize from environment variables
function createFileStorageServiceFromEnv(): FileStorageService {
  const provider = (process.env.FILE_STORAGE_PROVIDER || "local") as FileStorageConfig["provider"];
  
  const config: Partial<FileStorageConfig> = {
    provider,
  };

  // Configure S3
  if (provider === "aws-s3" || (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET)) {
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const s3Bucket = process.env.S3_BUCKET;
    const s3Region = process.env.S3_REGION || "us-east-1";

    if (awsAccessKeyId && awsSecretAccessKey && s3Bucket) {
      config.provider = "aws-s3";
      config.aws = {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
        bucket: s3Bucket,
        region: s3Region,
      };
      logger.info({ bucket: s3Bucket, region: s3Region }, "File storage configured for S3");
    }
  }

  // Configure GCS
  if (provider === "google-cloud" || (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GCS_BUCKET)) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GCS_BUCKET) {
      config.provider = "google-cloud";
      config.googleCloud = {
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        bucket: process.env.GCS_BUCKET,
      };
      logger.info({ bucket: process.env.GCS_BUCKET }, "File storage configured for GCS");
    }
  }

  // Configure Azure
  if (provider === "azure" || (process.env.AZURE_STORAGE_CONNECTION_STRING && process.env.AZURE_CONTAINER_NAME)) {
    if (process.env.AZURE_STORAGE_CONNECTION_STRING && process.env.AZURE_CONTAINER_NAME) {
      config.provider = "azure";
      config.azure = {
        connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
        container: process.env.AZURE_CONTAINER_NAME,
      };
      logger.info({ container: process.env.AZURE_CONTAINER_NAME }, "File storage configured for Azure");
    }
  }

  // Configure local storage defaults
  if (config.provider === "local") {
    const baseUrl = process.env.UPLOAD_BASE_URL;
    if (!baseUrl && process.env.NODE_ENV === "production") {
      throw new Error(
        "UPLOAD_BASE_URL environment variable is required in production. Set UPLOAD_BASE_URL in your environment configuration.",
      );
    }
    config.local = {
      uploadPath: process.env.UPLOAD_PATH || "./uploads",
      baseUrl: baseUrl || "http://localhost:3000/uploads", // Only allow localhost in development
    };
  }

  return new FileStorageService(config);
}

export const fileStorageService = createFileStorageServiceFromEnv();
