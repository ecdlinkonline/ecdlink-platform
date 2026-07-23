import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { auth as nextAuth } from "@/auth";
import { isUserRole, type UserRole } from "@/lib/auth/roles";

export type AuthContext = {
  provider: "clerk" | "nextauth";
  userId: string;
  email?: string;
  name?: string;
  role: UserRole | null;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const clerkSession = await clerkAuth();

  if (clerkSession.isAuthenticated) {
    const user = await currentUser();
    const metadataRole = user?.publicMetadata.role ?? user?.unsafeMetadata.role;
    const role = isUserRole(metadataRole) ? metadataRole : null;

    return {
      provider: "clerk",
      userId: clerkSession.userId,
      email: user?.primaryEmailAddress?.emailAddress,
      name: user?.fullName ?? user?.firstName ?? "ECDLink user",
      role
    };
  }

  const fallbackSession = await nextAuth();

  if (fallbackSession?.user?.email) {
    return {
      provider: "nextauth",
      userId: fallbackSession.user.email,
      email: fallbackSession.user.email,
      name: fallbackSession.user.name ?? "Fallback admin",
      role: fallbackSession.user.role ?? "super_admin"
    };
  }

  return null;
}
