import { ClipboardCheck, FileText, HandCoins, MessageSquare, ShoppingCart, UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CentreActivity } from "@/lib/centres/types";

const icons = {
  profile: UserRound,
  membership: FileText,
  procurement: ShoppingCart,
  compliance: ClipboardCheck,
  funding: HandCoins,
  note: MessageSquare
};

export function CentreActivityTimeline({ items }: { items: CentreActivity[] }) {
  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="dark:text-white">Activity timeline</CardTitle>
        <CardDescription className="dark:text-slate-400">Recent profile, support and operational activity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const Icon = icons[item.type];
          return (
            <div key={item.id} className="flex gap-3 rounded-lg border border-brand-line p-4 dark:border-slate-800">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-green-50 text-brand-green">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-brand-ink dark:text-white">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">{item.createdAt}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
