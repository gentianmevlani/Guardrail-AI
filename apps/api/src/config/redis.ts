/**
 * Shared Redis connection for BullMQ workers and schedulers
 */

import Redis from "ioredis";

const url = process.env.REDIS_URL || "redis://localhost:6379";

export const redisConfig = new Redis(url, {
  maxRetriesPerRequest: null,
});
