import { Skeleton } from "@/components/design-system";

export default function GrantReportLoading() {
  return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-20 w-full" /><div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]"><Skeleton className="h-96 w-full" /><Skeleton className="h-[36rem] w-full" /></div></div>;
}
