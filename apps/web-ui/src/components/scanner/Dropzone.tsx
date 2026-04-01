"use client";

import { Button } from "@/components/ui/button";
import { DEFAULT_SCANNER_CONFIG, type ValidationError } from "@/lib/scanner/types";
import { cn } from "@/lib/utils";
import { AlertCircle, File, FolderOpen, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export interface SelectedFile {
  file: File;
  relativePath: string;
}

interface DropzoneProps {
  onFilesSelected: (files: SelectedFile[]) => void;
  maxFiles?: number;
  maxTotalSize?: number;
  allowedExtensions?: string[];
  disabled?: boolean;
}

export function Dropzone({
  onFilesSelected,
  maxFiles = DEFAULT_SCANNER_CONFIG.maxFiles,
  maxTotalSize = DEFAULT_SCANNER_CONFIG.maxTotalSize,
  allowedExtensions = DEFAULT_SCANNER_CONFIG.allowedExtensions,
  disabled = false,
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback(
    (files: File[], basePath: string = ""): { valid: SelectedFile[]; errors: ValidationError[] } => {
      const valid: SelectedFile[] = [];
      const validationErrors: ValidationError[] = [];
      let totalSize = selectedFiles.reduce((sum, f) => sum + f.file.size, 0);

      for (const file of files) {
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        const relativePath = basePath ? `${basePath}/${file.name}` : file.name;

        if (!allowedExtensions.includes(ext)) {
          validationErrors.push({
            file: file.name,
            reason: "type",
            message: `Unsupported file type: ${ext}. Allowed: ${allowedExtensions.join(", ")}`,
          });
          continue;
        }

        if (file.size > DEFAULT_SCANNER_CONFIG.maxFileSize) {
          validationErrors.push({
            file: file.name,
            reason: "size",
            message: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max ${DEFAULT_SCANNER_CONFIG.maxFileSize / 1024 / 1024}MB)`,
          });
          continue;
        }

        if (selectedFiles.length + valid.length >= maxFiles) {
          validationErrors.push({
            file: file.name,
            reason: "count",
            message: `Maximum ${maxFiles} files allowed`,
          });
          break;
        }

        if (totalSize + file.size > maxTotalSize) {
          validationErrors.push({
            file: file.name,
            reason: "total_size",
            message: `Total size exceeds ${maxTotalSize / 1024 / 1024}MB limit`,
          });
          break;
        }

        totalSize += file.size;
        valid.push({ file, relativePath });
      }

      return { valid, errors: validationErrors };
    },
    [selectedFiles, maxFiles, maxTotalSize, allowedExtensions]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processEntry = async (
    entry: FileSystemEntry,
    path: string = ""
  ): Promise<File[]> => {
    const files: File[] = [];

    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      Object.defineProperty(file, "relativePath", { value: path ? `${path}/${file.name}` : file.name });
      files.push(file);
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });

      for (const childEntry of entries) {
        const childPath = path ? `${path}/${entry.name}` : entry.name;
        const childFiles = await processEntry(childEntry, childPath);
        files.push(...childFiles);
      }
    }

    return files;
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const items = e.dataTransfer.items;
      const allFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = item.webkitGetAsEntry();
        if (entry) {
          const files = await processEntry(entry);
          allFiles.push(...files);
        }
      }

      const { valid, errors: validationErrors } = validateFiles(allFiles);
      setErrors(validationErrors);

      if (valid.length > 0) {
        const newFiles = [...selectedFiles, ...valid];
        setSelectedFiles(newFiles);
        onFilesSelected(newFiles);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, validateFiles, selectedFiles, onFilesSelected]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const { valid, errors: validationErrors } = validateFiles(files);
      setErrors(validationErrors);

      if (valid.length > 0) {
        const newFiles = [...selectedFiles, ...valid];
        setSelectedFiles(newFiles);
        onFilesSelected(newFiles);
      }

      e.target.value = "";
    },
    [validateFiles, selectedFiles, onFilesSelected]
  );

  const handleFolderSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const filesWithPaths = files.map((file) => {
        const relativePath = (file as any).webkitRelativePath || file.name;
        return { file, relativePath };
      });

      const { valid, errors: validationErrors } = validateFiles(
        filesWithPaths.map((f) => f.file)
      );
      setErrors(validationErrors);

      if (valid.length > 0) {
        const newFiles = [...selectedFiles, ...valid];
        setSelectedFiles(newFiles);
        onFilesSelected(newFiles);
      }

      e.target.value = "";
    },
    [validateFiles, selectedFiles, onFilesSelected]
  );

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = selectedFiles.filter((_, i) => i !== index);
      setSelectedFiles(newFiles);
      onFilesSelected(newFiles);
    },
    [selectedFiles, onFilesSelected]
  );

  const clearAll = useCallback(() => {
    setSelectedFiles([]);
    setErrors([]);
    onFilesSelected([]);
  }, [onFilesSelected]);

  const totalSize = selectedFiles.reduce((sum, f) => sum + f.file.size, 0);

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200",
          "flex flex-col items-center justify-center min-h-[200px]",
          isDragging
            ? "border-cyan-500 bg-cyan-500/10"
            : "border-slate-700 hover:border-slate-600 bg-slate-900/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedExtensions.join(",")}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is not in types
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderSelect}
          className="hidden"
          disabled={disabled}
        />

        <div className="text-center">
          <div className="mb-4">
            <Upload
              className={cn(
                "w-12 h-12 mx-auto transition-colors",
                isDragging ? "text-cyan-400" : "text-slate-500"
              )}
            />
          </div>

          <h3 className="text-lg font-semibold text-white mb-2">
            {isDragging ? "Drop files here" : "Upload files to scan"}
          </h3>

          <p className="text-sm text-slate-400 mb-4">
            Drag & drop files or folders, or click to browse
          </p>

          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="gap-2"
            >
              <File className="w-4 h-4" />
              Select Files
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => folderInputRef.current?.click()}
              disabled={disabled}
              className="gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              Select Folder
            </Button>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            <p>
              Supported: {allowedExtensions.join(", ")} • Max {maxFiles} files •{" "}
              {maxTotalSize / 1024 / 1024}MB total
            </p>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              {errors.map((error, i) => (
                <p key={i} className="text-sm text-red-400">
                  <span className="font-medium">{error.file}:</span> {error.message}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between p-3 border-b border-slate-700">
            <div className="text-sm text-slate-300">
              <span className="font-medium">{selectedFiles.length}</span> file
              {selectedFiles.length !== 1 ? "s" : ""} selected
              <span className="text-slate-500 ml-2">
                ({(totalSize / 1024).toFixed(1)} KB)
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-slate-400 hover:text-white"
            >
              Clear all
            </Button>
          </div>

          <div className="max-h-[200px] overflow-y-auto">
            {selectedFiles.map((sf, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-3 py-2 hover:bg-slate-700/50 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <File className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="text-sm text-slate-300 truncate">
                    {sf.relativePath}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({(sf.file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-600 rounded transition-opacity"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
