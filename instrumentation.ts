export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { validateProductionEnvironment } = await import("@/lib/config/production");
  const result = validateProductionEnvironment();
  if (!result.valid) {
    console.error(`[production-readiness] Invalid production environment fields: ${result.invalidFields.join(", ")}`);
  }
}
