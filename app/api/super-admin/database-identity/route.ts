import { Prisma } from "@prisma/client";
import { requireIdentityAdmin } from "@/lib/api/identity-auth";
import { prisma } from "@/lib/db/prisma";
import { createDatabaseIdentityHandler } from "@/lib/diagnostics/database-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type DatabaseIdentityRow = {
  name: string;
  schema: string;
  serverVersion: string;
};

export const GET = createDatabaseIdentityHandler({
  authorize: async () => {
    const context = await requireIdentityAdmin();
    if ("error" in context) return context;
    return { internalUser: { id: context.internalUser.id, role: "SUPER_ADMIN", status: "ACTIVE" } };
  },
  queryIdentity: async () => {
    const rows = await prisma.$queryRaw<DatabaseIdentityRow[]>(Prisma.sql`
      SELECT
        current_database() AS "name",
        current_schema() AS "schema",
        current_setting('server_version') AS "serverVersion"
    `);
    const identity = rows[0];
    if (!identity) throw new Error("Database identity query returned no rows.");
    return identity;
  },
  readConnections: () => ({
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL
  })
});
