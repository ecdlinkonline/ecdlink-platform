import {
  ClipboardCheck,
  HandCoins,
  ShoppingCart,
  UsersRound,
  WalletCards
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EcdCentre } from "@/lib/centres/types";

function statusVariant(status: string) {
  if (["Active", "Compliant", "Ready", "Registered"].includes(status)) return "success" as const;
  if (["Pending", "Attention", "In Progress"].includes(status)) return "warning" as const;
  return "muted" as const;
}

export function CentreStatusCards({ centre }: { centre: EcdCentre }) {
  const cards = [
    { label: "Membership", value: centre.membershipStatus, icon: WalletCards },
    { label: "Procurement", value: centre.procurementStatus, icon: ShoppingCart },
    { label: "Compliance", value: centre.complianceStatus, icon: ClipboardCheck },
    { label: "Funding Readiness", value: centre.fundingReadinessStatus, icon: HandCoins },
    { label: "Children", value: String(centre.numberOfChildren), icon: UsersRound }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className="dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-5">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-brand-navy dark:bg-slate-800 dark:text-blue-200">
              <card.icon className="h-5 w-5" />
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-500 dark:text-slate-400">{card.label}</p>
            {card.label === "Children" ? (
              <p className="mt-2 text-2xl font-bold text-brand-ink dark:text-white">{card.value}</p>
            ) : (
              <div className="mt-3">
                <Badge variant={statusVariant(card.value)}>{card.value}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
