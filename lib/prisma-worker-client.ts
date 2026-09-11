import { PrismaClient } from "@prisma/client/wasm.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

function createPrismaClient() {
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

export async function withPrisma<T>(operation: (client: PrismaClient) => Promise<T>) {
  const client = createPrismaClient();
  try {
    return await operation(client);
  } finally {
    await client.$disconnect();
  }
}
