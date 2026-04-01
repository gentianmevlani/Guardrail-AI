/**
 * File Upload Utilities
 * 
 * Essential file upload handling that AI agents often miss
 * Handles multipart/form-data, validation, and storage
 */

import { Request } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';

export interface FileUploadConfig {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  destination?: string;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Create multer storage configuration
 */
const createStorage = (destination: string = 'uploads/') => {
  return multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        await fs.mkdir(destination, { recursive: true });
        cb(null, destination);
      } catch (error) {
        cb(error as Error, destination);
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = `${randomUUID()}${ext}`;
      cb(null, filename);
    },
  });
};

/**
 * File filter for allowed types
 */
const createFileFilter = (allowedTypes: string[]) => {
  return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  };
};

/**
 * Create file upload middleware
 */
export const createFileUpload = (config: FileUploadConfig = {}) => {
  const {
    maxSize = DEFAULT_MAX_SIZE,
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    destination = 'uploads/',
  } = config;

  return multer({
    storage: createStorage(destination),
    fileFilter: createFileFilter(allowedTypes),
    limits: {
      fileSize: maxSize,
    },
  });
};

/**
 * Single file upload
 */
export const uploadSingle = (fieldName: string = 'file', config?: FileUploadConfig) => {
  return createFileUpload(config).single(fieldName);
};

/**
 * Multiple file upload
 */
export const uploadMultiple = (fieldName: string = 'files', maxCount: number = 5, config?: FileUploadConfig) => {
  return createFileUpload(config).array(fieldName, maxCount);
};

/**
 * Validate uploaded file
 */
export const validateFile = (file: Express.Multer.File, config: FileUploadConfig = {}): {
  valid: boolean;
  error?: string;
} => {
  const { maxSize = DEFAULT_MAX_SIZE, allowedTypes = DEFAULT_ALLOWED_TYPES } = config;

  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${maxSize / 1024 / 1024}MB` };
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: `File type ${file.mimetype} not allowed` };
  }

  return { valid: true };
};

/**
 * Delete uploaded file
 */
export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};

