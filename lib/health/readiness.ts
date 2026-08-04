import "server-only";

import { prisma } from "@/lib/db/prisma";
import { createEmailProvider } from "@/lib/email/service";
import { getEmailConfig } from "@/lib/email/config";
import { validateProductionEnvironment } from "@/lib/config/production";
import { getStorageConfig } from "@/lib/storage/config";
import { verifySupabaseStorageBucket } from "@/lib/storage/supabase-storage-provider";
import { defaultDocumentPolicy } from "@/lib/storage/validation";

export type ReadinessComponent = "configuration" | "database" | "storage" | "email";
export type ReadinessComponentResult = { component: ReadinessComponent; status: "ready" | "not_ready" };
export type ReadinessResult = { ready: boolean; checkedAt: string; components: ReadinessComponentResult[] };

export type ReadinessDependencies = {
  checkConfiguration(): Promise<boolean> | boolean;
  checkDatabase(): Promise<boolean>;
  checkStorage(): Promise<boolean>;
  checkEmail(): Promise<boolean>;
  timeoutMs: number;
  now(): Date;
};

export const DEFAULT_READINESS_CHECK_TIMEOUT_MS = 5_000;

export function withReadinessTimeout<T>(operation: () => Promise<T>, timeoutMs = DEFAULT_READINESS_CHECK_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Readiness dependency timed out.")), timeoutMs);
    operation().then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function readinessTimeout(environment: Record<string, string | undefined>) {
  const value = Number(environment.READINESS_CHECK_TIMEOUT_MS ?? DEFAULT_READINESS_CHECK_TIMEOUT_MS);
  return Number.isInteger(value) && value >= 500 && value <= 15_000 ? value : DEFAULT_READINESS_CHECK_TIMEOUT_MS;
}

export function createReadinessDependencies(environment: Record<string, string | undefined> = process.env): ReadinessDependencies {
  return {
    checkConfiguration: () => validateProductionEnvironment(environment).valid,
    checkDatabase: async () => { await prisma.$queryRaw`SELECT 1`; return true; },
    checkStorage: async () => {
      const config = getStorageConfig();
      const bucket = await verifySupabaseStorageBucket(config);
      const allowedTypes = new Set(bucket.allowedMimeTypes ?? []);
      return !bucket.public
        && bucket.fileSizeLimit != null
        && bucket.fileSizeLimit <= defaultDocumentPolicy.maxBytes
        && defaultDocumentPolicy.allowedMimeTypes.every((type) => allowedTypes.has(type));
    },
    checkEmail: async () => (await createEmailProvider(getEmailConfig(environment)).health()).healthy,
    timeoutMs: readinessTimeout(environment),
    now: () => new Date(),
  };
}

async function safelyCheck(check: () => Promise<boolean> | boolean) {
  try { return Boolean(await check()); } catch { return false; }
}

export async function checkReadiness(dependencies: ReadinessDependencies = createReadinessDependencies()): Promise<ReadinessResult> {
  const checks: Array<[ReadinessComponent, () => Promise<boolean> | boolean, boolean]> = [
    ["configuration", dependencies.checkConfiguration, false],
    ["database", dependencies.checkDatabase, true],
    ["storage", dependencies.checkStorage, true],
    ["email", dependencies.checkEmail, true],
  ];
  const values = await Promise.all(checks.map(async ([component, check, external]) => ({
    component,
    status: await safelyCheck(() => external
      ? withReadinessTimeout(() => Promise.resolve(check()), dependencies.timeoutMs)
      : check()) ? "ready" as const : "not_ready" as const,
  })));
  return { ready: values.every((value) => value.status === "ready"), checkedAt: dependencies.now().toISOString(), components: values };
}
