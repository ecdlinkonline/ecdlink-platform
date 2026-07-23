import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="h-8 w-72 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
