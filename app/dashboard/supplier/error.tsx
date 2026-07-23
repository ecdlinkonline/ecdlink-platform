"use client";

import { Alert } from "@/components/design-system";
import { Button } from "@/components/ui/button";

export default function SupplierError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <Alert
        tone="warning"
        title="Supplier portal could not load"
        description="Please check supplier access and the database connection."
      />

      <Button onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}