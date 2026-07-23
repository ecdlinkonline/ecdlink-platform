import { NextResponse } from "next/server";
import { hasDatabaseConfig } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import type { DbHealth } from "@/lib/db/types";

export async function GET() {
  const checkedAt = new Date().toISOString();

  if (!hasDatabaseConfig()) {
    return NextResponse.json<DbHealth>({ ok: false, provider: "postgresql", checkedAt, error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json<DbHealth>({ ok: true, provider: "postgresql", checkedAt });
  } catch (error) {
    console.error("Database health check failed", error);
    return NextResponse.json<DbHealth>({ ok: false, provider: "postgresql", checkedAt, error: "Database health check failed." }, { status: 503 });
  }
}
