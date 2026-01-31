/**
 * Use Cases Module
 *
 * Exports all use cases following the CQRS pattern.
 *
 * Commands (modify state):
 * - CaptureMeasurementUseCase - Captures a new measurement
 *
 * Queries (read state):
 * - ViewHistoryUseCase - Retrieves measurement history
 * - GenerateReportUseCase - Generates health reports
 *
 * @module application/use-cases
 */

// Commands
export {
  CaptureMeasurementUseCase,
  type CaptureMeasurementInput,
  type CaptureMeasurementOutput,
  ProfileNotFoundError,
} from './CaptureMeasurementUseCase';

// Queries
export {
  ViewHistoryUseCase,
  type ViewHistoryInput,
  type ViewHistoryOutput,
} from './ViewHistoryUseCase';

export {
  GenerateReportUseCase,
  type GenerateReportInput,
  type GenerateReportOutput,
} from './GenerateReportUseCase';
