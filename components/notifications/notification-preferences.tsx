"use client";

import type { NotificationDeliveryPreference, NotificationType } from "@prisma/client";
import { notificationDeliveryPreferences, notificationTypes } from "@/lib/notifications/types";

const labels: Record<NotificationDeliveryPreference, string> = { BOTH: "Both", IN_APP: "In app", EMAIL: "Email", NONE: "None" };

export function NotificationPreferences({ values, onSaved }: { values: Partial<Record<NotificationType, NotificationDeliveryPreference>>; onSaved: () => void }) {
  async function update(type: NotificationType, delivery: NotificationDeliveryPreference) {
    const response = await fetch("/api/notifications/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, delivery }) });
    if (!response.ok) throw new Error("Preference could not be saved.");
    onSaved();
  }

  return <div className="space-y-3">
    <p className="text-xs text-slate-500">Email choices are stored for Sprint 10C. Sprint 10A delivers in-app notifications only.</p>
    {notificationTypes.filter((type) => type.startsWith("FUNDING_")).map((type) => <label key={type} className="flex items-center justify-between gap-3 text-xs">
      <span className="max-w-52 font-semibold text-slate-700 dark:text-slate-200">{type.replaceAll("_", " ").toLowerCase()}</span>
      <select className="rounded-md border border-brand-line bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900" value={values[type] ?? "BOTH"} onChange={(event) => void update(type, event.target.value as NotificationDeliveryPreference)}>
        {notificationDeliveryPreferences.map((delivery) => <option key={delivery} value={delivery}>{labels[delivery]}</option>)}
      </select>
    </label>)}
  </div>;
}
