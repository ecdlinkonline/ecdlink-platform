"use client";

import Link from "next/link";
import type { NotificationModule, NotificationType } from "@prisma/client";

export type NotificationItem = { id: string; module: NotificationModule; type: NotificationType; title: string; body: string; href: string | null; readAt: string | null; createdAt: string };

export function NotificationList({ items, onReadChange }: { items: NotificationItem[]; onReadChange: (id: string, read: boolean) => void }) {
  if (!items.length) return <p className="rounded-lg border border-dashed border-brand-line p-6 text-center text-sm text-slate-500 dark:border-slate-700">No notifications match these filters.</p>;
  return <div className="divide-y divide-brand-line dark:divide-slate-800">{items.map((item) => <article key={item.id} className={`py-3 ${item.readAt ? "opacity-70" : ""}`}>
    <div className="flex items-start justify-between gap-3">
      <div>{item.href ? <Link href={item.href} onClick={() => onReadChange(item.id, true)} className="text-sm font-bold text-brand-navy dark:text-blue-200">{item.title}</Link> : <p className="text-sm font-bold">{item.title}</p>}<p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.body}</p><p className="mt-1 text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p></div>
      <button type="button" className="shrink-0 text-xs font-semibold text-brand-navy dark:text-blue-200" onClick={() => onReadChange(item.id, !item.readAt)}>{item.readAt ? "Unread" : "Read"}</button>
    </div>
  </article>)}</div>;
}
