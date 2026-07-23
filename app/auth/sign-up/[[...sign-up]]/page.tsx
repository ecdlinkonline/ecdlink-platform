import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Join ECDLink"
      title="Create your secure ECDLink account."
      description="After account creation, choose your organisation role so ECDLink can route you to the right dashboard and onboarding journey."
    >
      <div className="flex justify-center">
        <SignUp
          path="/auth/sign-up"
          routing="path"
          signInUrl="/auth/sign-in"
          fallbackRedirectUrl="/auth/select-role"
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
