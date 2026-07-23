"use client";

import { Alert, PageHeader } from "@/components/design-system";
import { Button } from "@/components/ui/button";

export default function MembershipsError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Membership & Billing" description="The membership dashboard could not be loaded." />
      <Alert tone="warning" title="Membership data unavailable" description="Please check the database connection and try again." />
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
