import { PrismaClient } from "@prisma/client";

/**
 * One PrismaClient per process. Next's dev server re-evaluates modules on
 * every edit, so without the global cache you exhaust SQLite file handles
 * after a dozen saves.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * SQLite defaults to rollback-journal mode, where a single writer blocks every
 * reader. Under widget traffic this app is overwhelmingly read-heavy with
 * occasional writes, which is the exact shape WAL exists for: readers never
 * block the writer and the writer never blocks readers.
 *
 * Set once per process, guarded so a failure can't stop the app booting —
 * a non-file datasource or a read-only volume should degrade, not crash.
 */
const globalForPragma = globalThis as unknown as { walSet?: boolean };
if (!globalForPragma.walSet) {
  globalForPragma.walSet = true;
  // NOTE: these are $queryRaw, not $executeRaw. Both PRAGMAs return a row,
  // and Prisma rejects a result-returning statement on $executeRaw with
  // "Execute returned results, which is not allowed in SQLite."
  void prisma
    .$queryRawUnsafe("PRAGMA journal_mode=WAL;")
    .then(() => prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;"))
    .catch((err) => {
      console.warn("[nodpeak] could not enable WAL:", (err as Error).message);
    });
}

export default prisma;
