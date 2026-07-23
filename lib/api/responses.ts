import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function validationError(error: ZodError) {
  return apiError("Validation failed.", 422, error.flatten());
}

export function statusFromError(error: Error, fallback = 400) {
  const candidate = (error as Error & { status?: unknown }).status;
  return typeof candidate === "number" ? candidate : fallback;
}
