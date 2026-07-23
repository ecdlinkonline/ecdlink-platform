import { ClipboardCheck, FileText, HandCoins, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function CentreModulePlaceholders() {
  const placeholders = [
    { title: "Uploaded documents", description: "Compliance documents will appear here.", icon: ClipboardCheck },
    { title: "Procurement history", description: "Monthly procurement orders will appear here.", icon: ShoppingCart },
    { title: "Funding applications", description: "Funding readiness and application history will appear here.", icon: HandCoins },
    { title: "Reports", description: "Centre profile reports will appear here.", icon: FileText }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {placeholders.map((item) => (
        <Card key={item.title} className="dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-5">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-accent text-brand-navy dark:bg-slate-800 dark:text-blue-200">
              <item.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 font-bold text-brand-ink dark:text-white">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
