import { Skeleton } from "@/components/design-system";

export default function AdminComplianceLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32" />)}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
