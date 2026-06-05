import { PrismaClient } from "@prisma/client";

const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST;

if (!TEST_DATABASE_URL) {
  throw new Error(
    "DATABASE_URL_TEST is not set. Did you forget to load .env or run docker compose up -d postgres-test?",
  );
}

export const prismaTest = new PrismaClient({
  datasources: { db: { url: TEST_DATABASE_URL } },
  log: ["error"],
});

export async function cleanDatabase(): Promise<void> {
  await prismaTest.booking.deleteMany();
  await prismaTest.professionalService.deleteMany();
  await prismaTest.customer.deleteMany();
  await prismaTest.professional.deleteMany();
  await prismaTest.service.deleteMany();
  await prismaTest.user.deleteMany();
  await prismaTest.tenant.deleteMany();
}

export async function disconnectPrismaTest(): Promise<void> {
  await prismaTest.$disconnect();
}