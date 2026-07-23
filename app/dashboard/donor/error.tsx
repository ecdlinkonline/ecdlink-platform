"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold">Donor portal could not load</h2>
            <p className="text-sm text-muted-foreground">Please try again. If this continues, check the database connection and seed state.</p>
          </div>
          <Button onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
