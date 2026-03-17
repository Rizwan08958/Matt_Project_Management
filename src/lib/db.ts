import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const resolvedDatabaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL;

export const isDatabaseConfigured = Boolean(resolvedDatabaseUrl);

const createMissingDatabaseProxy = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(
          "Missing database URL. Set DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL)."
        );
      },
    }
  ) as PrismaClient;

export const db =
  globalForPrisma.prisma ??
  (isDatabaseConfigured
    ? new PrismaClient({
        datasources: {
          db: { url: resolvedDatabaseUrl },
        },
        log:
          process.env.NODE_ENV === "development"
            ? ["error", "warn"]
            : ["error"],
      })
    : createMissingDatabaseProxy());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
