import { prisma } from "@/lib/db/prisma";

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  process.stdout.write("Database connection healthy.\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
