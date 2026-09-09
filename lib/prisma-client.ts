import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

export function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 1, connectionTimeoutMillis: 10000 }),
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
