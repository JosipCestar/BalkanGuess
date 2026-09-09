import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

export function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      query_timeout: 8_000,
    }),
  });
}

const globalForPrisma = globalThis as unknown as { runtimePrisma?: ReturnType<typeof createPrismaClient> };

function runtimePrisma() {
  globalForPrisma.runtimePrisma ??= createPrismaClient();
  return globalForPrisma.runtimePrisma;
}

export async function withPrisma<T>(operation: (client: PrismaClient) => Promise<T>) {
  return operation(runtimePrisma());
}
