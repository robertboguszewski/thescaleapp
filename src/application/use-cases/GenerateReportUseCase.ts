/**
 * GenerateReportUseCase
 *
 * CQRS Query: Generates a comprehensive health report for a user profile.
 *
 * The report includes:
 * - Latest measurement data
 * - Trends over the last 30 days
 * - Priority health recommendations
 * - Overall health status summary
 *
 * @module application/use-cases/GenerateReportUseCase
 */

import type { ReportService, HealthReport } from '../services/ReportService';

/**
 * Input for generating a health report
 */
export interface GenerateReportInput {
  /** The profile ID to generate the report for */
  profileId: string;
}

/**
 * Output from generating a health report
 * (Re-exports HealthReport from ReportService for consistency)
 */
export type GenerateReportOutput = HealthReport;

/**
 * Use case for generating a comprehensive health report
 *
 * This is a CQRS query that delegates to the ReportService for
 * complex report generation logic. The use case provides a clean
 * interface for the presentation layer.
 */
export class GenerateReportUseCase {
  constructor(private readonly reportService: ReportService) {}

  /**
   * Execute the use case
   *
   * @param input - The input containing the profile ID
   * @returns Complete health report with trends and recommendations
   * @throws ProfileNotFoundError if profile doesn't exist (from ReportService)
   * @throws NoMeasurementsError if no measurements exist for report (from ReportService)
   */
  async execute(input: GenerateReportInput): Promise<GenerateReportOutput> {
    return this.reportService.generateReport(input.profileId);
  }
}
