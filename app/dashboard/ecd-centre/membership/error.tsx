"use client";

import { Alert, PageHeader } from "@/components/design-system";
import { Button } from "@/components/ui/button";

export default function CentreMembershipError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader title="My Membership" description="Your centre membership record could not be loaded." />
      <Alert tone="warning" title="Membership data unavailable" description="Please try again or contact ECDLink support." />
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
