import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell
      eyebrow="Clerk authentication"
      title="Secure access for every ECDLink role."
      description="Sign in with Clerk to enter the correct ECDLink workspace for centres, suppliers, donors, funding partners and platform administrators."
    >
      <div className="flex justify-center">
        <SignIn
          path="/auth/sign-in"
          routing="path"
          signUpUrl="/auth/sign-up"
          fallbackRedirectUrl="/dashboard"
          appearance={{
            elements: {
              cardBox: "shadow-soft border border-brand-line rounded-2xl",
              formButtonPrimary: "bg-brand-navy hover:bg-blue-950",
              footerActionLink: "text-brand-navy"
            }
          }}
        />
      </div>
    </AuthShell>
  );
}
