"use client";

import { ErrorState } from "@/components/states/app-states";

export default function DashboardError() {
  return (
    <ErrorState
      title="Dashboard could not load"
      description="The workspace shell is available, but this route failed to render. Please refresh or return to your dashboard."
    />
  );
}
