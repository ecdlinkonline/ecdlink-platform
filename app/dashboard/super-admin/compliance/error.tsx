"use client";

import { Alert, PageHeader } from "@/components/design-system";
import { Button } from "@/components/ui/button";

export default function AdminComplianceError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Compliance Management" description="Compliance records could not be loaded." />
      <Alert tone="warning" title="Compliance data unavailable" description="Please check the database connection and try again." />
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
