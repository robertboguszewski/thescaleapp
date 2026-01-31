/**
 * File System Utilities
 *
 * Provides async file operations for JSON storage.
 * All operations handle errors gracefully.
 *
 * @module infrastructure/storage/file-utils
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';

/**
 * Custom error for storage operations
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: 'READ_ERROR' | 'WRITE_ERROR' | 'DELETE_ERROR' | 'DIR_ERROR' | 'PARSE_ERROR' | 'VALIDATION_ERROR',
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Ensure a directory exists, creating it recursively if needed
 *
 * @param dirPath - Absolute path to the directory
 * @throws StorageError if directory cannot be created
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new StorageError(
      `Failed to create directory: ${dirPath}`,
      'DIR_ERROR',
      error as Error
    );
  }
}

/**
 * Read and parse a JSON file
 *
 * @param filePath - Absolute path to the JSON file
 * @returns Parsed JSON content
 * @throws StorageError if file cannot be read or parsed
 */
export async function readJSON<T>(filePath: string): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err.code === 'ENOENT') {
      throw new StorageError(
        `File not found: ${filePath}`,
        'READ_ERROR',
        err
      );
    }

    if (err instanceof SyntaxError) {
      throw new StorageError(
        `Invalid JSON in file: ${filePath}`,
        'PARSE_ERROR',
        err
      );
    }

    throw new StorageError(
      `Failed to read file: ${filePath}`,
      'READ_ERROR',
      err
    );
  }
}

/**
 * Write data to a JSON file
 * Creates parent directories if they don't exist
 *
 * @param filePath - Absolute path to the JSON file
 * @param data - Data to serialize and write
 * @throws StorageError if file cannot be written
 */
export async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  try {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    await ensureDir(dir);

    // Write with pretty formatting for readability
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(
      `Failed to write file: ${filePath}`,
      'WRITE_ERROR',
      error as Error
    );
  }
}

/**
 * Delete a file if it exists
 * No error if file doesn't exist
 *
 * @param filePath - Absolute path to the file
 * @throws StorageError if file exists but cannot be deleted
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    // File doesn't exist - that's fine
    if (err.code === 'ENOENT') {
      return;
    }

    throw new StorageError(
      `Failed to delete file: ${filePath}`,
      'DELETE_ERROR',
      err
    );
  }
}

/**
 * Check if a file exists
 *
 * @param filePath - Absolute path to the file
 * @returns true if file exists, false otherwise
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List files in a directory matching an optional pattern
 *
 * @param dirPath - Absolute path to the directory
 * @param pattern - Optional regex pattern to filter filenames
 * @returns Array of absolute file paths
 * @throws StorageError if directory cannot be read
 */
export async function listFiles(dirPath: string, pattern?: RegExp): Promise<string[]> {
  try {
    // Check if directory exists
    try {
      await fs.access(dirPath);
    } catch {
      // Directory doesn't exist, return empty array
      return [];
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    let files = entries
      .filter(entry => entry.isFile())
      .map(entry => path.join(dirPath, entry.name));

    if (pattern) {
      files = files.filter(filePath => pattern.test(path.basename(filePath)));
    }

    return files;
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(
      `Failed to list directory: ${dirPath}`,
      'DIR_ERROR',
      error as Error
    );
  }
}

/**
 * Read a JSON file, returning a default value if file doesn't exist
 *
 * @param filePath - Absolute path to the JSON file
 * @param defaultValue - Value to return if file doesn't exist
 * @returns Parsed JSON content or default value
 */
export async function readJSONOrDefault<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    return await readJSON<T>(filePath);
  } catch (error) {
    if (error instanceof StorageError && error.code === 'READ_ERROR') {
      return defaultValue;
    }
    throw error;
  }
}

/**
 * Generate a unique temporary file path in the same directory
 * Using the same directory ensures atomic rename works across filesystems
 */
function getTempPath(dir: string): string {
  const randomSuffix = randomBytes(8).toString('hex');
  const tempFileName = `.tmp-${Date.now()}-${randomSuffix}`;
  return path.join(dir, tempFileName);
}

/**
 * Safely cleanup temporary file
 */
async function cleanupTempFile(tempPath: string): Promise<void> {
  try {
    await fs.unlink(tempPath);
  } catch {
    // Silently ignore cleanup errors (file may not exist)
  }
}

/**
 * Write data to a JSON file atomically
 * Uses temp file + rename pattern to prevent data corruption on crash
 *
 * This is the preferred method for writing critical data as it guarantees:
 * - Original file is never partially written
 * - If process crashes mid-write, original file is untouched
 * - Readers never see inconsistent state
 *
 * @param filePath - Absolute path to the JSON file
 * @param data - Data to serialize and write
 * @throws StorageError if file cannot be written
 */
export async function atomicWriteJSON<T>(filePath: string, data: T): Promise<void> {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);
  const tempPath = getTempPath(dir);

  try {
    // Ensure parent directory exists
    await ensureDir(dir);

    // Serialize data first (can throw on circular references)
    const content = JSON.stringify(data, null, 2);

    // Write to temp file
    await fs.writeFile(tempPath, content, 'utf-8');

    // Atomically replace original file
    await fs.rename(tempPath, absolutePath);
  } catch (error) {
    // Cleanup temp file on error
    await cleanupTempFile(tempPath);

    if (error instanceof StorageError) {
      throw error;
    }

    throw new StorageError(
      `Failed to write file atomically: ${filePath}`,
      'WRITE_ERROR',
      error as Error
    );
  }
}
