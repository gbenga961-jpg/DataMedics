/**
 * Queue Definitions & Stable Job Identifiers (PRD §16 and background-job-reliability skill)
 * Stable deterministic queue IDs:
 * - Analysis: analysis-{processingJobId}
 * - Cleaning: cleaning-{cleaningRunId}
 */

import { Queue } from "bullmq";
import { getRedisClient } from "./redis";
import {
  ANALYSIS_QUEUE_NAME,
  CLEANING_QUEUE_NAME,
  EXPIRY_QUEUE_NAME,
  AnalysisJobPayload,
  CleaningJobPayload,
  ExpiryJobPayload,
} from "../types/jobs";

export function getAnalysisQueue(): Queue<AnalysisJobPayload> {
  return new Queue<AnalysisJobPayload>(ANALYSIS_QUEUE_NAME, {
    connection: getRedisClient(),
  });
}

export function getCleaningQueue(): Queue<CleaningJobPayload> {
  return new Queue<CleaningJobPayload>(CLEANING_QUEUE_NAME, {
    connection: getRedisClient(),
  });
}

export function getExpiryQueue(): Queue<ExpiryJobPayload> {
  return new Queue<ExpiryJobPayload>(EXPIRY_QUEUE_NAME, {
    connection: getRedisClient(),
  });
}

export function buildAnalysisJobId(processingJobId: string): string {
  return `analysis-${processingJobId}`;
}

export function buildCleaningJobId(cleaningRunId: string): string {
  return `cleaning-${cleaningRunId}`;
}
