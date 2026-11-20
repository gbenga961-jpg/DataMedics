/**
 * Redis Connection Helper for BullMQ & Caching
 * Ensures lazy initialization and connection separation.
 */

import Redis from "ioredis";
import { getConfig } from "./config";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const config = getConfig();
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      lazyConnect: true,
    });
  }
  return redisClient;
}
