/**
 * JsonProfileRepository
 *
 * File-based JSON implementation of ProfileRepository.
 * Stores each profile as a separate JSON file.
 *
 * File naming convention: {id}.json
 *
 * @module infrastructure/storage/JsonProfileRepository
 */

import * as path from 'path';
import type {
  ProfileRepository,
  StoredUserProfile,
} from '../../application/ports/ProfileRepository';
import {
  ensureDir,
  readJSON,
  atomicWriteJSON,
  deleteFile,
  listFiles,
  fileExists,
} from './file-utils';
import {
  StoredUserProfileSchema,
  toStoredProfile,
  fromStoredProfile,
  type StoredProfile,
} from './schemas';

/**
 * JSON file-based implementation of ProfileRepository
 */
export class JsonProfileRepository implements ProfileRepository {
  private readonly dataDir: string;

  /**
   * @param dataDir - Directory path where profile files will be stored
   */
  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /**
   * Get the file path for a profile
   */
  private getFilePath(id: string): string {
    return path.join(this.dataDir, `${id}.json`);
  }

  async save(profile: StoredUserProfile): Promise<void> {
    // Update the updatedAt timestamp
    const profileWithUpdatedTimestamp: StoredUserProfile = {
      ...profile,
      updatedAt: new Date(),
    };

    // Validate the profile data
    const storedData = toStoredProfile(profileWithUpdatedTimestamp);
    const validation = StoredUserProfileSchema.safeParse(storedData);

    if (!validation.success) {
      throw new Error(`Invalid profile data: ${validation.error.message}`);
    }

    // Ensure directory exists
    await ensureDir(this.dataDir);

    // Write the profile to file
    const filePath = this.getFilePath(profile.id);
    await atomicWriteJSON(filePath, storedData);
  }

  async getById(id: string): Promise<StoredUserProfile | null> {
    const filePath = this.getFilePath(id);

    if (!(await fileExists(filePath))) {
      return null;
    }

    try {
      const storedData = await readJSON<StoredProfile>(filePath);

      // Validate the loaded data
      const validation = StoredUserProfileSchema.safeParse(storedData);
      if (!validation.success) {
        // Invalid data - treat as not found
        console.warn(`Invalid profile data in file ${filePath}: ${validation.error.message}`);
        return null;
      }

      return fromStoredProfile(validation.data);
    } catch (error) {
      // File read error - treat as not found
      return null;
    }
  }

  async getAll(): Promise<StoredUserProfile[]> {
    const files = await listFiles(this.dataDir, /\.json$/);

    // Load all profiles
    const profiles: StoredUserProfile[] = [];

    for (const filePath of files) {
      try {
        const storedData = await readJSON<StoredProfile>(filePath);

        // Validate the loaded data
        const validation = StoredUserProfileSchema.safeParse(storedData);
        if (!validation.success) {
          console.warn(`Skipping invalid profile in file ${filePath}`);
          continue;
        }

        profiles.push(fromStoredProfile(validation.data));
      } catch (error) {
        console.warn(`Error reading profile file ${filePath}:`, error);
        continue;
      }
    }

    // Sort by name ascending (case-insensitive)
    profiles.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    return profiles;
  }

  async delete(id: string): Promise<void> {
    const filePath = this.getFilePath(id);
    await deleteFile(filePath);
  }

  async getDefault(): Promise<StoredUserProfile | null> {
    const profiles = await this.getAll();
    return profiles.find(p => p.isDefault) ?? null;
  }

  async setDefault(id: string): Promise<void> {
    // First, verify the profile exists
    const profile = await this.getById(id);
    if (!profile) {
      throw new Error(`Profile with id ${id} not found`);
    }

    // Get all profiles
    const allProfiles = await this.getAll();

    // Update all profiles: remove default from others, set default for target
    for (const p of allProfiles) {
      const shouldBeDefault = p.id === id;

      // Only update if the default status needs to change
      if (p.isDefault !== shouldBeDefault) {
        await this.save({
          ...p,
          isDefault: shouldBeDefault,
        });
      }
    }
  }
}
