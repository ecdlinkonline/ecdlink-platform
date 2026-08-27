import "server-only";

import { createHash } from "node:crypto";
import { apiError } from "@/lib/api/responses";

export type ConnectionIdentity =
  | { configured: false }
  | { configured: true; validUrl: false }
  | { configured: true; validUrl: true; hostnameSha256: string };

export type DatabaseIdentity = {
  name: string;
  schema: string;
  serverVersion: string;
};

export type DatabaseIdentityRouteDependencies = {
  authorize: () => Promise<{ error: Response } | { internalUser: { id: string; role: "SUPER_ADMIN"; status: "ACTIVE" } }>;
  queryIdentity: () => Promise<DatabaseIdentity>;
  readConnections: () => { databaseUrl: string | undefined; directUrl: string | undefined };
};

export function fingerprintConnectionUrl(value: string | undefined): ConnectionIdentity {
  if (!value) return { configured: false };

  try {
    const hostname = new URL(value).hostname.trim().toLowerCase();
    if (!hostname) return { configured: true, validUrl: false };

    return {
      configured: true,
      validUrl: true,
      hostnameSha256: createHash("sha256").update(hostname).digest("hex").slice(0, 16)
    };
  } catch {
    return { configured: true, validUrl: false };
  }
}

export function createDatabaseIdentityHandler(dependencies: DatabaseIdentityRouteDependencies) {
  return async function GET() {
    const authorization = await dependencies.authorize();
    if ("error" in authorization) {
      authorization.error.headers.set("Cache-Control", "no-store, max-age=0");
      return authorization.error;
    }

    try {
      const database = await dependencies.queryIdentity();
      const connections = dependencies.readConnections();

      return Response.json(
        {
          database,
          connections: {
            databaseUrl: fingerprintConnectionUrl(connections.databaseUrl),
            directUrl: fingerprintConnectionUrl(connections.directUrl)
          }
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    } catch {
      const response = apiError("Database identity is temporarily unavailable.", 500);
      response.headers.set("Cache-Control", "no-store, max-age=0");
      return response;
    }
  };
}
