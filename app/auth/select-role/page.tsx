import { auth } from "@clerk/nextjs/server";
import { RoleSelectionForm } from "@/components/auth/role-selection-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function SelectRolePage() {
  const { isAuthenticated, redirectToSignIn } = await auth();

  if (!isAuthenticated) {
    return redirectToSignIn();
  }

  return (
    <AuthShell
      eyebrow="Role setup"
      title="Every ECDLink user gets the right workspace."
      description="ECDLink uses role-based access to keep centre operations, supplier workflows, donor reporting and funding reviews cleanly separated."
    >
      <RoleSelectionForm />
    </AuthShell>
  );
}
