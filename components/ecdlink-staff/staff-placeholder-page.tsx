import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StaffPlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="text-2xl dark:text-white">{title}</CardTitle>
        <CardDescription className="dark:text-slate-400">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed border-brand-line bg-brand-accent p-8 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          This workspace page is routed, protected and ready for the next implementation phase.
        </div>
      </CardContent>
    </Card>
  );
}
