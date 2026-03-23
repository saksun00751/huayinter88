import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

function createPrismaClient() {
  const dbUrl = new URL(process.env.DATABASE_URL!);
  const adapter = new PrismaMariaDb({
    host:            dbUrl.hostname,
    port:            Number(dbUrl.port || 3306),
    user:            dbUrl.username,
    password:        dbUrl.password,
    database:        dbUrl.pathname.slice(1),
    connectionLimit: 10,
    minimumIdle:     2,
    idleTimeout:     60,
    timezone:        "+07:00",
  });
  return new PrismaClient({ adapter });
}

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientInstance | undefined;
};

export const prisma: PrismaClientInstance =
  globalForPrisma.prisma ?? createPrismaClient();

// เก็บ singleton ทั้ง dev และ production เพื่อป้องกัน multiple instances
globalForPrisma.prisma = prisma;
