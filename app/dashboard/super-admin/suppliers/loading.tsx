import { Skeleton } from "@/components/design-system";

export default function AdminSuppliersLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
