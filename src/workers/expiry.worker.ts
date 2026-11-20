/**
 * Retention & Expiry Worker (PRD §21, Amendment J06)
 * Processes file expiry and safe physical deletion tasks.
 */

import { Worker } from "bullmq";
import { EXPIRY_QUEUE_NAME, ExpiryJobPayload } from "@/types/jobs";
import { getRedisClient } from "@/lib/redis";
import { processRetentionAndDeletion } from "@/services/retention";

export function createExpiryWorker(): Worker<ExpiryJobPayload> {
  return new Worker<ExpiryJobPayload>(
    EXPIRY_QUEUE_NAME,
    async (_job) => {
      const summary = await processRetentionAndDeletion();
      return summary;
    },
    {
      connection: getRedisClient(),
      concurrency: 1,
    }
  );
}

export { processRetentionAndDeletion };
