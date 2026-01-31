/**
 * DI Container Tests
 *
 * TDD tests for the dependency injection container.
 * Tests written BEFORE implementation.
 *
 * @module main/__tests__/container.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'reflect-metadata';
import { container, TOKENS, initializeContainer, clearContainer } from '../container';
import type { MeasurementRepository } from '../../application/ports/MeasurementRepository';
import type { ProfileRepository } from '../../application/ports/ProfileRepository';
import type { BLEPort } from '../../application/ports/BLEPort';
import type { XiaomiCloudPort } from '../../application/ports/XiaomiCloudPort';
import type { MeasurementService } from '../../application/services/MeasurementService';
import type { ProfileService } from '../../application/services/ProfileService';
import type { ReportService } from '../../application/services/ReportService';
import type { BackupService } from '../../application/services/BackupService';

describe('DI Container', () => {
  beforeEach(() => {
    clearContainer();
  });

  describe('TOKENS', () => {
    it('should define all repository tokens', () => {
      expect(TOKENS.MeasurementRepository).toBeDefined();
      expect(TOKENS.ProfileRepository).toBeDefined();
    });

    it('should define all port tokens', () => {
      expect(TOKENS.BLEPort).toBeDefined();
      expect(TOKENS.XiaomiCloudPort).toBeDefined();
    });

    it('should define all service tokens', () => {
      expect(TOKENS.MeasurementService).toBeDefined();
      expect(TOKENS.ProfileService).toBeDefined();
      expect(TOKENS.ReportService).toBeDefined();
      expect(TOKENS.BackupService).toBeDefined();
    });

    it('should have unique token values', () => {
      const tokens = Object.values(TOKENS);
      const uniqueTokens = new Set(tokens.map((t) => t.toString()));

      expect(uniqueTokens.size).toBe(tokens.length);
    });
  });

  describe('initializeContainer', () => {
    it('should register all dependencies', () => {
      initializeContainer({ dataPath: '/tmp/test-data', useMockBLE: true });

      // Check repositories
      expect(container.isRegistered(TOKENS.MeasurementRepository)).toBe(true);
      expect(container.isRegistered(TOKENS.ProfileRepository)).toBe(true);

      // Check ports
      expect(container.isRegistered(TOKENS.BLEPort)).toBe(true);
      expect(container.isRegistered(TOKENS.XiaomiCloudPort)).toBe(true);

      // Check services
      expect(container.isRegistered(TOKENS.MeasurementService)).toBe(true);
      expect(container.isRegistered(TOKENS.ProfileService)).toBe(true);
      expect(container.isRegistered(TOKENS.ReportService)).toBe(true);
    });

    it('should resolve MeasurementService with dependencies', () => {
      initializeContainer({ dataPath: '/tmp/test-data', useMockBLE: true });

      const service = container.resolve<MeasurementService>(TOKENS.MeasurementService);

      expect(service).toBeDefined();
    });

    it('should resolve ProfileService with dependencies', () => {
      initializeContainer({ dataPath: '/tmp/test-data', useMockBLE: true });

      const service = container.resolve<ProfileService>(TOKENS.ProfileService);

      expect(service).toBeDefined();
    });

    it('should resolve ReportService with dependencies', () => {
      initializeContainer({ dataPath: '/tmp/test-data', useMockBLE: true });

      const service = container.resolve<ReportService>(TOKENS.ReportService);

      expect(service).toBeDefined();
    });

    it('should return singleton instances for services', () => {
      initializeContainer({ dataPath: '/tmp/test-data', useMockBLE: true });

      const service1 = container.resolve<MeasurementService>(TOKENS.MeasurementService);
      const service2 = container.resolve<MeasurementService>(TOKENS.MeasurementService);

      expect(service1).toBe(service2);
    });

    it('should use mock BLE when useMockBLE is true', () => {
      initializeContainer({ dataPath: '/tmp/test-data', useMockBLE: true });

      const blePort = container.resolve<BLEPort>(TOKENS.BLEPort);

      // Mock BLE should return 'disconnected' state
      expect(blePort.getState()).toBe('disconnected');
    });
  });

  describe('clearContainer', () => {
    it('should clear all registrations', () => {
      initializeContainer({ dataPath: '/tmp/test-data', useMockBLE: true });

      expect(container.isRegistered(TOKENS.MeasurementService)).toBe(true);

      clearContainer();

      expect(container.isRegistered(TOKENS.MeasurementService)).toBe(false);
    });
  });

  describe('custom registration', () => {
    it('should allow registering mock implementations for testing', () => {
      const mockMeasurementRepo: Partial<MeasurementRepository> = {
        save: vi.fn(),
        getById: vi.fn().mockResolvedValue(null),
        getAll: vi.fn().mockResolvedValue([]),
      };

      container.register(TOKENS.MeasurementRepository, {
        useValue: mockMeasurementRepo as MeasurementRepository,
      });

      const resolved = container.resolve<MeasurementRepository>(TOKENS.MeasurementRepository);

      expect(resolved).toBe(mockMeasurementRepo);
    });
  });
});
