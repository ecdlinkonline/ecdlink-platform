import { Skeleton } from "@/components/design-system";

export default function CentreComplianceLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32" />)}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
