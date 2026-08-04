import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requiresAuthentication } from "@/lib/security/route-access";

export default clerkMiddleware(async (auth, request) => {
  if (request.nextUrl.pathname === "/auth/fallback" && process.env.ECDLINK_ENABLE_FALLBACK_ADMIN !== "true") {
    return new NextResponse(null, { status: 404 });
  }
  if (requiresAuthentication(request.nextUrl.pathname)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)"
  ]
};
