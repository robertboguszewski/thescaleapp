/**
 * File Utils Tests
 *
 * Tests for file system utilities used by repositories.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ensureDir,
  readJSON,
  writeJSON,
  deleteFile,
  fileExists,
  listFiles,
  readJSONOrDefault,
  StorageError,
} from '../file-utils';

const TEST_DIR = path.join(process.cwd(), 'test-data', 'file-utils-test');

describe('File Utils', () => {
  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('ensureDir', () => {
    it('should create a directory if it does not exist', async () => {
      const dirPath = path.join(TEST_DIR, 'new-dir');

      await ensureDir(dirPath);

      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create nested directories recursively', async () => {
      const dirPath = path.join(TEST_DIR, 'level1', 'level2', 'level3');

      await ensureDir(dirPath);

      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not throw if directory already exists', async () => {
      const dirPath = path.join(TEST_DIR, 'existing-dir');
      await fs.mkdir(dirPath, { recursive: true });

      await expect(ensureDir(dirPath)).resolves.not.toThrow();
    });
  });

  describe('writeJSON', () => {
    it('should write JSON data to a file', async () => {
      const filePath = path.join(TEST_DIR, 'test.json');
      const data = { name: 'test', value: 123 };

      await writeJSON(filePath, data);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should create parent directories if they do not exist', async () => {
      const filePath = path.join(TEST_DIR, 'nested', 'dir', 'test.json');
      const data = { nested: true };

      await writeJSON(filePath, data);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should write with pretty formatting', async () => {
      const filePath = path.join(TEST_DIR, 'pretty.json');
      const data = { key: 'value' };

      await writeJSON(filePath, data);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('\n'); // Pretty printed has newlines
    });

    it('should overwrite existing file', async () => {
      const filePath = path.join(TEST_DIR, 'overwrite.json');
      await writeJSON(filePath, { old: 'data' });

      const newData = { new: 'data' };
      await writeJSON(filePath, newData);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(newData);
    });
  });

  describe('readJSON', () => {
    it('should read and parse JSON from a file', async () => {
      const filePath = path.join(TEST_DIR, 'read.json');
      const data = { name: 'test', values: [1, 2, 3] };
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data));

      const result = await readJSON<typeof data>(filePath);

      expect(result).toEqual(data);
    });

    it('should throw StorageError for non-existent file', async () => {
      const filePath = path.join(TEST_DIR, 'nonexistent.json');

      await expect(readJSON(filePath)).rejects.toThrow(StorageError);
      await expect(readJSON(filePath)).rejects.toMatchObject({
        code: 'READ_ERROR',
      });
    });

    it('should throw StorageError for invalid JSON', async () => {
      const filePath = path.join(TEST_DIR, 'invalid.json');
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(filePath, 'not valid json {{{');

      await expect(readJSON(filePath)).rejects.toThrow(StorageError);
      await expect(readJSON(filePath)).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });
  });

  describe('readJSONOrDefault', () => {
    it('should return file content when file exists', async () => {
      const filePath = path.join(TEST_DIR, 'exists.json');
      const data = { value: 'exists' };
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data));

      const result = await readJSONOrDefault(filePath, { value: 'default' });

      expect(result).toEqual(data);
    });

    it('should return default value when file does not exist', async () => {
      const filePath = path.join(TEST_DIR, 'not-exists.json');
      const defaultValue = { value: 'default' };

      const result = await readJSONOrDefault(filePath, defaultValue);

      expect(result).toEqual(defaultValue);
    });

    it('should still throw for invalid JSON', async () => {
      const filePath = path.join(TEST_DIR, 'invalid-or-default.json');
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(filePath, 'invalid json');

      await expect(
        readJSONOrDefault(filePath, { default: true })
      ).rejects.toThrow(StorageError);
    });
  });

  describe('deleteFile', () => {
    it('should delete an existing file', async () => {
      const filePath = path.join(TEST_DIR, 'delete-me.json');
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(filePath, '{}');

      await deleteFile(filePath);

      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('should not throw for non-existent file', async () => {
      const filePath = path.join(TEST_DIR, 'already-gone.json');

      await expect(deleteFile(filePath)).resolves.not.toThrow();
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = path.join(TEST_DIR, 'exists.json');
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(filePath, '{}');

      const exists = await fileExists(filePath);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const filePath = path.join(TEST_DIR, 'not-exists.json');

      const exists = await fileExists(filePath);

      expect(exists).toBe(false);
    });
  });

  describe('listFiles', () => {
    it('should list all files in a directory', async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(path.join(TEST_DIR, 'file1.json'), '{}');
      await fs.writeFile(path.join(TEST_DIR, 'file2.json'), '{}');
      await fs.writeFile(path.join(TEST_DIR, 'file3.txt'), 'text');

      const files = await listFiles(TEST_DIR);

      expect(files).toHaveLength(3);
      expect(files).toContain(path.join(TEST_DIR, 'file1.json'));
      expect(files).toContain(path.join(TEST_DIR, 'file2.json'));
      expect(files).toContain(path.join(TEST_DIR, 'file3.txt'));
    });

    it('should filter files by pattern', async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(path.join(TEST_DIR, 'file1.json'), '{}');
      await fs.writeFile(path.join(TEST_DIR, 'file2.json'), '{}');
      await fs.writeFile(path.join(TEST_DIR, 'file3.txt'), 'text');

      const files = await listFiles(TEST_DIR, /\.json$/);

      expect(files).toHaveLength(2);
      expect(files).toContain(path.join(TEST_DIR, 'file1.json'));
      expect(files).toContain(path.join(TEST_DIR, 'file2.json'));
      expect(files).not.toContain(path.join(TEST_DIR, 'file3.txt'));
    });

    it('should return empty array for non-existent directory', async () => {
      const files = await listFiles(path.join(TEST_DIR, 'non-existent'));

      expect(files).toEqual([]);
    });

    it('should not include subdirectories', async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.mkdir(path.join(TEST_DIR, 'subdir'));
      await fs.writeFile(path.join(TEST_DIR, 'file.json'), '{}');

      const files = await listFiles(TEST_DIR);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('file.json');
    });
  });

  describe('StorageError', () => {
    it('should include code and cause', () => {
      const cause = new Error('Original error');
      const error = new StorageError('Test error', 'READ_ERROR', cause);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('READ_ERROR');
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('StorageError');
    });
  });

  describe('atomicWriteJSON', () => {
    it('should write JSON data atomically', async () => {
      const { atomicWriteJSON } = await import('../file-utils');
      const filePath = path.join(TEST_DIR, 'atomic-test.json');
      const data = { name: 'test', value: 123 };

      await atomicWriteJSON(filePath, data);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should create parent directories if they do not exist', async () => {
      const { atomicWriteJSON } = await import('../file-utils');
      const filePath = path.join(TEST_DIR, 'nested', 'deep', 'atomic.json');
      const data = { nested: true };

      await atomicWriteJSON(filePath, data);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should not leave temp files on success', async () => {
      const { atomicWriteJSON } = await import('../file-utils');
      const filePath = path.join(TEST_DIR, 'no-temp.json');
      await atomicWriteJSON(filePath, { test: true });

      const files = await fs.readdir(TEST_DIR);
      const tempFiles = files.filter(f => f.startsWith('.tmp-'));

      expect(tempFiles).toHaveLength(0);
    });

    it('should overwrite existing file atomically', async () => {
      const { atomicWriteJSON } = await import('../file-utils');
      const filePath = path.join(TEST_DIR, 'atomic-overwrite.json');

      await atomicWriteJSON(filePath, { old: 'data' });
      await atomicWriteJSON(filePath, { new: 'data' });

      const content = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual({ new: 'data' });
    });

    it('should preserve file content on serialization error', async () => {
      const { atomicWriteJSON } = await import('../file-utils');
      const filePath = path.join(TEST_DIR, 'preserve-on-error.json');
      const originalData = { original: true };

      await atomicWriteJSON(filePath, originalData);

      // Create circular reference that cannot be serialized
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;

      await expect(atomicWriteJSON(filePath, circular)).rejects.toThrow();

      // Original file should be unchanged
      const content = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(originalData);
    });

    it('should write with pretty formatting', async () => {
      const { atomicWriteJSON } = await import('../file-utils');
      const filePath = path.join(TEST_DIR, 'atomic-pretty.json');

      await atomicWriteJSON(filePath, { key: 'value' });

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('\n');
    });
  });
});
