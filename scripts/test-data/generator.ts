#!/usr/bin/env node
/**
 * Test Data Generator for Xiaomi Scale Measurements
 *
 * Generates realistic body composition data matching the project's storage schemas.
 * Creates individual JSON files in the correct directories for the app to read.
 *
 * Usage:
 *   npm run test-data:generate    # Generate test data
 *   npm run test-data:remove      # Remove test data
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// Interfaces (matching project's storage schemas)
// ============================================

interface UserProfile {
  gender: 'male' | 'female';
  birthYear: number;
  heightCm: number;
  ethnicity?: 'asian' | 'non-asian';
}

interface RawMeasurement {
  weightKg: number;
  impedanceOhm?: number;
  heartRateBpm?: number;
}

interface CalculatedMetrics {
  bmi: number;
  bodyFatPercent: number;
  muscleMassKg: number;
  bodyWaterPercent: number;
  boneMassKg: number;
  visceralFatLevel: number;
  bmrKcal: number;
  leanBodyMassKg: number;
  proteinPercent: number;
  bodyScore: number;
}

/** Matches StoredUserProfileSchema in src/infrastructure/storage/schemas.ts */
interface StoredProfile {
  id: string; // UUID
  name: string;
  gender: 'male' | 'female';
  birthYear: number;
  birthMonth?: number;
  heightCm: number;
  ethnicity?: 'asian' | 'non-asian';
  isDefault: boolean;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

/** Matches StoredMeasurementSchema in src/infrastructure/storage/schemas.ts */
interface StoredMeasurement {
  id: string; // UUID
  timestamp: string; // ISO datetime
  raw: RawMeasurement;
  calculated: CalculatedMetrics;
  userProfileId: string; // UUID
}

// ============================================
// Calculation Functions (standalone versions)
// ============================================

function calculateAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}

function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function calculateBodyFat(profile: UserProfile, measurement: RawMeasurement): number {
  const age = calculateAge(profile.birthYear);
  const bmi = calculateBMI(measurement.weightKg, profile.heightCm);
  // Deurenberg formula (1992)
  const genderFactor = profile.gender === 'male' ? 1 : 0;
  return 1.20 * bmi + 0.23 * age - 10.8 * genderFactor - 5.4;
}

function calculateLBM(profile: UserProfile, measurement: RawMeasurement): number {
  // Boer formula
  if (profile.gender === 'male') {
    return 0.407 * measurement.weightKg + 0.267 * profile.heightCm - 19.2;
  } else {
    return 0.252 * measurement.weightKg + 0.473 * profile.heightCm - 48.3;
  }
}

function calculateBodyWater(profile: UserProfile, measurement: RawMeasurement): number {
  // Hume-Weyers formula
  if (profile.gender === 'male') {
    return 0.194786 * profile.heightCm + 0.296785 * measurement.weightKg - 14.012934;
  } else {
    return 0.34454 * profile.heightCm + 0.183809 * measurement.weightKg - 35.270121;
  }
}

function calculateBMR(profile: UserProfile, measurement: RawMeasurement): number {
  const age = calculateAge(profile.birthYear);
  // Mifflin-St Jeor equation
  if (profile.gender === 'male') {
    return 10 * measurement.weightKg + 6.25 * profile.heightCm - 5 * age + 5;
  } else {
    return 10 * measurement.weightKg + 6.25 * profile.heightCm - 5 * age - 161;
  }
}

function estimateVisceralFat(profile: UserProfile, bmi: number): number {
  const age = calculateAge(profile.birthYear);
  let vf: number;
  if (profile.gender === 'male') {
    vf = (bmi - 10) * 0.5 + (age - 20) * 0.1;
  } else {
    vf = (bmi - 10) * 0.4 + (age - 20) * 0.08;
  }
  return Math.max(1, Math.min(30, Math.round(vf)));
}

function calculateBodyScore(
  metrics: { bmi: number; bodyFatPercent: number; visceralFatLevel: number },
  profile: UserProfile
): number {
  let score = 100;

  // BMI penalty
  if (metrics.bmi < 18.5) score -= (18.5 - metrics.bmi) * 5;
  else if (metrics.bmi > 25) score -= (metrics.bmi - 25) * 3;

  // Body fat penalty
  const idealBF = profile.gender === 'male' ? 15 : 25;
  const bfDiff = Math.abs(metrics.bodyFatPercent - idealBF);
  score -= bfDiff * 1.5;

  // Visceral fat penalty
  if (metrics.visceralFatLevel > 10) {
    score -= (metrics.visceralFatLevel - 10) * 2;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function calculateAllMetrics(profile: UserProfile, measurement: RawMeasurement): CalculatedMetrics {
  const bmi = calculateBMI(measurement.weightKg, profile.heightCm);
  let bodyFatPercent = calculateBodyFat(profile, measurement);
  bodyFatPercent = Math.max(3, Math.min(60, bodyFatPercent));

  const leanBodyMassKg = calculateLBM(profile, measurement);
  const muscleMassKg = leanBodyMassKg * 0.75;
  const bodyWaterLiters = calculateBodyWater(profile, measurement);
  const bodyWaterPercent = (bodyWaterLiters / measurement.weightKg) * 100;
  const boneRatio = profile.gender === 'male' ? 0.04 : 0.03;
  const boneMassKg = leanBodyMassKg * boneRatio;
  const bmrKcal = calculateBMR(profile, measurement);
  const visceralFatLevel = estimateVisceralFat(profile, bmi);
  const musclePercent = (muscleMassKg / measurement.weightKg) * 100;
  const proteinPercent = musclePercent * 0.22;
  const bodyScore = calculateBodyScore({ bmi, bodyFatPercent, visceralFatLevel }, profile);

  return {
    bmi: round(bmi, 1),
    bodyFatPercent: round(bodyFatPercent, 1),
    muscleMassKg: round(muscleMassKg, 1),
    bodyWaterPercent: round(bodyWaterPercent, 1),
    boneMassKg: round(boneMassKg, 1),
    visceralFatLevel: Math.round(visceralFatLevel),
    bmrKcal: Math.round(bmrKcal),
    leanBodyMassKg: round(leanBodyMassKg, 1),
    proteinPercent: round(proteinPercent, 1),
    bodyScore: Math.round(bodyScore),
  };
}

// ============================================
// Configuration
// ============================================
const CONFIG = {
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  startWeight: 107.0,
  endWeight: 105.0,
  heightCm: 190,
  userName: 'Test User',
  birthYear: 1990,
  gender: 'male' as const,
};

const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Determine data directory based on target mode
// Development: ./data (project root)
// Production: ~/Library/Application Support/thescale-app/data (macOS)
function getDataDir(forProduction: boolean): string {
  if (forProduction) {
    // Production path - matches Electron's app.getPath('userData')
    const platform = process.platform;
    const appName = 'thescale-app';

    if (platform === 'darwin') {
      return path.join(process.env.HOME || '', 'Library', 'Application Support', appName, 'data');
    } else if (platform === 'win32') {
      return path.join(process.env.APPDATA || '', appName, 'data');
    } else {
      // Linux
      return path.join(process.env.HOME || '', '.config', appName, 'data');
    }
  }
  // Development path
  return path.join(PROJECT_ROOT, 'data');
}

// Check if --production flag is passed
const isProduction = process.argv.includes('--production') || process.argv.includes('-p');
const DATA_DIR = getDataDir(isProduction);
const PROFILES_DIR = path.join(DATA_DIR, 'profiles');
const MEASUREMENTS_DIR = path.join(DATA_DIR, 'measurements');

// Keep track of generated profile ID for linking measurements
let generatedProfileId: string = '';

// ============================================
// Utility Functions
// ============================================

function getDaysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function addDays(date: string, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function generateImpedance(bodyFatPercent: number): number {
  const baseImpedance = 550 - bodyFatPercent * 3;
  const variation = Math.floor(Math.random() * 50) - 25;
  return Math.round(baseImpedance + variation);
}

function formatTimestampForFilename(date: Date): string {
  return date.toISOString().replace(/:/g, '-');
}

// ============================================
// Data Generation
// ============================================

function generateUserProfile(): StoredProfile {
  const profileId = randomUUID();
  generatedProfileId = profileId;
  const now = new Date(CONFIG.startDate).toISOString();

  return {
    id: profileId,
    name: CONFIG.userName,
    gender: CONFIG.gender,
    birthYear: CONFIG.birthYear,
    heightCm: CONFIG.heightCm,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
}

function generateMeasurementForDay(
  date: Date,
  weight: number,
  userProfile: UserProfile
): StoredMeasurement {
  const estimatedBodyFat = 25 + (weight - 100) * 0.3;
  const impedance = generateImpedance(estimatedBodyFat);

  const rawMeasurement: RawMeasurement = {
    weightKg: Math.round(weight * 100) / 100,
    impedanceOhm: impedance,
  };

  const metrics = calculateAllMetrics(userProfile, rawMeasurement);

  const hour = 6 + Math.floor(Math.random() * 3);
  const minute = Math.floor(Math.random() * 60);
  const timestamp = new Date(date);
  timestamp.setHours(hour, minute, 0, 0);

  return {
    id: randomUUID(),
    timestamp: timestamp.toISOString(),
    raw: rawMeasurement,
    calculated: metrics,
    userProfileId: generatedProfileId,
  };
}

function generateAllMeasurements(): StoredMeasurement[] {
  const totalDays = getDaysBetween(CONFIG.startDate, CONFIG.endDate);
  const weightChangePerDay = (CONFIG.startWeight - CONFIG.endWeight) / totalDays;
  const measurements: StoredMeasurement[] = [];

  const userProfile: UserProfile = {
    gender: CONFIG.gender,
    birthYear: CONFIG.birthYear,
    heightCm: CONFIG.heightCm,
  };

  const age = calculateAge(CONFIG.birthYear);

  console.log(`\n  Generating ${totalDays} daily measurements...`);
  console.log(`  Weight progression: ${CONFIG.startWeight}kg → ${CONFIG.endWeight}kg`);
  console.log(`  User age: ${age} years\n`);

  for (let day = 0; day < totalDays; day++) {
    const baseWeight = CONFIG.startWeight - weightChangePerDay * day;
    const fluctuation = Math.random() * 0.6 - 0.3;
    const weight = Math.round((baseWeight + fluctuation) * 100) / 100;

    const date = addDays(CONFIG.startDate, day);
    const measurement = generateMeasurementForDay(date, weight, userProfile);

    measurements.push(measurement);

    process.stdout.write(`\r  Processing day ${day + 1}/${totalDays}...`);
  }

  console.log('\n');
  return measurements;
}

// ============================================
// File Operations
// ============================================

function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`  ✓ Created directory: ${dir}`);
  }
}

function saveJSON(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function removeTestData(): void {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     Xiaomi Scale Test Data Remover                    ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('  Target Mode:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
  console.log('  Data Directory:', DATA_DIR);
  console.log('');

  let removedCount = 0;

  // Remove profiles
  if (fs.existsSync(PROFILES_DIR)) {
    const files = fs.readdirSync(PROFILES_DIR).filter((f) => f.endsWith('.json'));
    files.forEach((file) => {
      const filePath = path.join(PROFILES_DIR, file);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        // Only remove profiles named "Test User"
        if (content.name === CONFIG.userName) {
          fs.unlinkSync(filePath);
          console.log(`  ✓ Removed profile: ${file}`);
          removedCount++;
        }
      } catch {
        // Skip invalid files
      }
    });
  }

  // Remove measurements linked to test user
  if (fs.existsSync(MEASUREMENTS_DIR)) {
    const files = fs.readdirSync(MEASUREMENTS_DIR).filter((f) => f.endsWith('.json'));
    files.forEach((file) => {
      const filePath = path.join(MEASUREMENTS_DIR, file);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        // Check if this measurement belongs to a test profile
        // We'll remove measurements from January 2026 as they're test data
        const timestamp = new Date(content.timestamp);
        if (timestamp >= new Date('2026-01-01') && timestamp <= new Date('2026-01-31')) {
          fs.unlinkSync(filePath);
          removedCount++;
        }
      } catch {
        // Skip invalid files
      }
    });
    if (removedCount > 0) {
      console.log(`  ✓ Removed ${removedCount} test measurements`);
    }
  }

  if (removedCount === 0) {
    console.log('  No test data found to remove.\n');
  } else {
    console.log(`\n  ✓ Removed ${removedCount} test data files.\n`);
  }
}

function generateTestData(): void {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     Xiaomi Scale Test Data Generator                  ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('  Target Mode:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
  console.log('  Data Directory:', DATA_DIR);
  console.log('');
  console.log('  Configuration:');
  console.log(`    Date range: ${CONFIG.startDate} to ${CONFIG.endDate}`);
  console.log(`    Height: ${CONFIG.heightCm}cm`);
  console.log(`    Start weight: ${CONFIG.startWeight}kg`);
  console.log(`    End weight: ${CONFIG.endWeight}kg`);
  console.log(`    User: ${CONFIG.userName} (${CONFIG.gender}, born ${CONFIG.birthYear})`);

  // Ensure directories exist
  ensureDirectoryExists(PROFILES_DIR);
  ensureDirectoryExists(MEASUREMENTS_DIR);

  // Generate and save profile
  console.log('\n  Generating user profile...');
  const userProfile = generateUserProfile();
  const profilePath = path.join(PROFILES_DIR, `${userProfile.id}.json`);
  saveJSON(profilePath, userProfile);
  console.log(`  ✓ Saved profile: ${profilePath}`);

  // Generate and save measurements (individual files)
  const measurements = generateAllMeasurements();

  console.log('  Saving measurement files...');
  for (const measurement of measurements) {
    const timestamp = formatTimestampForFilename(new Date(measurement.timestamp));
    const filename = `${timestamp}_${measurement.id}.json`;
    const filePath = path.join(MEASUREMENTS_DIR, filename);
    saveJSON(filePath, measurement);
  }
  console.log(`  ✓ Saved ${measurements.length} measurement files`);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║                    Summary                            ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Profile ID: ${userProfile.id}`);
  console.log(`║  Profile:    ${profilePath}`);
  console.log(`║  Measurements: ${MEASUREMENTS_DIR}/`);
  console.log(`║  Total Records: ${measurements.length}`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('  Sample measurement (Day 1):');
  console.log(
    JSON.stringify(measurements[0], null, 2)
      .split('\n')
      .map((l) => '    ' + l)
      .join('\n')
  );

  console.log('\n  ✓ Test data generation complete!');
  console.log('  Restart the app to see the test data.');
  console.log('  To remove test data, run: npm run test-data:remove\n');
}

// ============================================
// Main Entry Point
// ============================================

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0] || '--generate';

  switch (command) {
    case '--generate':
    case '-g':
      generateTestData();
      break;
    case '--remove':
    case '-r':
      removeTestData();
      break;
    case '--help':
    case '-h':
      console.log('\nUsage: npx ts-node scripts/test-data/generator.ts [command] [options]');
      console.log('\nCommands:');
      console.log('  --generate, -g    Generate test data (default)');
      console.log('  --remove, -r      Remove test data');
      console.log('  --help, -h        Show this help message');
      console.log('\nOptions:');
      console.log('  --production, -p  Write to production data directory');
      console.log('                    (~/Library/Application Support/thescale-app/data on macOS)');
      console.log('\nExamples:');
      console.log('  npx ts-node scripts/test-data/generator.ts --generate');
      console.log('  npx ts-node scripts/test-data/generator.ts --generate --production');
      console.log('  npx ts-node scripts/test-data/generator.ts --remove --production\n');
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main();
