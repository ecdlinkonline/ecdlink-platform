"use client";

import { Alert } from "@/components/design-system";
import { Button } from "@/components/ui/button";

export default function AdminSuppliersError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <Alert
        tone="warning"
        title="Supplier management could not load"
        description="Please check the database connection and try again."
      />

      <Button onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}