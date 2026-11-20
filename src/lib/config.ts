/**
 * Application Configuration & Safe Environment Access
 * Respects Docs/.agent/rules/.security.md and DECISIONS.md
 */

export interface AppConfig {
  nodeEnv: "development" | "production" | "test";
  port: number;
  appUrl: string;
  databaseUrl: string;
  redisUrl: string;
  storage: {
    endpoint?: string;
    region?: string;
    bucket: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    useSsl: boolean;
  };
  limits: {
    maxUploadSizeBytes: number;
    // Temporary limits allowed before OD-04 approval (DECISIONS.md rule 14)
    tempMaxColumns: number;
    tempMaxFieldSizeBytes: number;
  };
}

export function getConfig(): AppConfig {
  const nodeEnv = (process.env.NODE_ENV as AppConfig["nodeEnv"]) || "development";
  const port = parseInt(process.env.PORT || "3000", 10);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`;
  const databaseUrl = process.env.DATABASE_URL || "";
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  const maxUploadSizeBytes = parseInt(
    process.env.MAX_UPLOAD_SIZE_BYTES || "10485760", // 10MB default
    10
  );

  const tempMaxColumns = parseInt(
    process.env.TEMP_MAX_COLUMNS || "100",
    10
  );

  const tempMaxFieldSizeBytes = parseInt(
    process.env.TEMP_MAX_FIELD_SIZE_BYTES || "32768", // 32KB default
    10
  );

  return {
    nodeEnv,
    port,
    appUrl,
    databaseUrl,
    redisUrl,
    storage: {
      endpoint: process.env.STORAGE_ENDPOINT,
      region: process.env.STORAGE_REGION,
      bucket: process.env.STORAGE_BUCKET || "datamedics-private",
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
      useSsl: process.env.STORAGE_USE_SSL !== "false",
    },
    limits: {
      maxUploadSizeBytes,
      tempMaxColumns,
      tempMaxFieldSizeBytes,
    },
  };
}
