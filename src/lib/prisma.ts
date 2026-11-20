/**
 * Prisma Client Singleton Instance
 * Adheres to Database Door in AGENTS.md (no eager connection on import).
 */

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    return new PrismaClient();
  }

  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({
      log: ["warn", "error"],
    });
  }

  return global.prismaGlobal;
}
