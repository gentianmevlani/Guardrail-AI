/**
 * Minimal typing for legacy `redis` imports when @types/redis is not installed.
 */
declare module "redis" {
  import type { EventEmitter } from "events";

  export interface RedisClientOptions {
    url?: string;
    socket?: { reconnectStrategy?: (retries: number) => number | Error };
  }

  export type RedisClientType = EventEmitter & {
    connect(): Promise<void>;
    quit(): Promise<void>;
    on(event: string, listener: (...args: unknown[]) => void): RedisClientType;
  };

  export function createClient(options?: RedisClientOptions): RedisClientType;
}
