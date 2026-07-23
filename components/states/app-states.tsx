import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function LoadingState({ title = "Loading workspace" }: { title?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Card>
        <CardContent className="flex items-center gap-3 p-6">
          <Loader2 className="h-5 w-5 animate-spin text-brand-navy" />
          <p className="font-semibold text-brand-ink">{title}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-brand-accent text-brand-navy">
          <Inbox className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-brand-ink">{title}</h2>
        <p className="mx-auto mt-2 max-w-md leading-7 text-slate-600">{description}</p>
      </CardContent>
    </Card>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "Please refresh the page or return to your dashboard."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Card>
        <CardContent className="p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-red-50 text-red-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-brand-ink">{title}</h2>
          <p className="mx-auto mt-2 max-w-md leading-7 text-slate-600">{description}</p>
          <Button className="mt-5">Return to dashboard</Button>
        </CardContent>
      </Card>
    </div>
  );
}
