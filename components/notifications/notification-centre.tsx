"use client";

import { Bell, Settings, X } from "lucide-react";
import type { NotificationDeliveryPreference, NotificationModule, NotificationType } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { notificationModules } from "@/lib/notifications/types";
import { NotificationList, type NotificationItem } from "./notification-list";
import { NotificationPreferences } from "./notification-preferences";

type Page = { items: NotificationItem[]; nextCursor: string | null; unreadCount: number };

export function NotificationCentre() {
  const [open, setOpen] = useState(false), [settings, setSettings] = useState(false), [page, setPage] = useState<Page>({ items: [], nextCursor: null, unreadCount: 0 });
  const [module, setModule] = useState<NotificationModule | "">(""), [read, setRead] = useState<"ALL" | "READ" | "UNREAD">("ALL"), [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<Partial<Record<NotificationType, NotificationDeliveryPreference>>>({});
  const closeRef = useRef<HTMLButtonElement>(null), triggerRef = useRef<HTMLButtonElement>(null);
  const load = useCallback(async (cursor?: string) => { setLoading(true); try { const query = new URLSearchParams({ read }); if (module) query.set("module", module); if (cursor) query.set("cursor", cursor); const response = await fetch(`/api/notifications?${query}`); const json = await response.json(); if (response.ok) setPage((current) => ({ ...json.data, items: cursor ? [...current.items, ...json.data.items] : json.data.items })); } finally { setLoading(false); } }, [module, read]);
  const loadPreferences = useCallback(async () => { const response = await fetch("/api/notifications/preferences"); const json = await response.json(); if (response.ok) setPreferences(Object.fromEntries(json.data.map((item: { type: NotificationType; delivery: NotificationDeliveryPreference }) => [item.type, item.delivery]))); }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (open) { void load(); closeRef.current?.focus(); } }, [load, open]);
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } }; window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape); }, []);
  async function setReadState(id: string, nextRead: boolean) { const response = await fetch(`/api/notifications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: nextRead }) }); if (response.ok) await load(); }
  async function markAllRead() { await fetch("/api/notifications/read-all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(module ? { module } : {}) }); await load(); }
  return <>
    <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-lg border border-brand-line text-slate-600 dark:border-slate-800 dark:text-slate-300" aria-label={`Notifications${page.unreadCount ? `, ${page.unreadCount} unread` : ""}`}><Bell className="h-5 w-5" />{page.unreadCount ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-[10px] font-bold leading-5 text-white">{page.unreadCount > 99 ? "99+" : page.unreadCount}</span> : null}</button>
    {open ? <div className="fixed inset-0 z-[70] bg-slate-950/40" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="notification-title" className="ml-auto flex h-full w-full max-w-md flex-col bg-white p-5 shadow-2xl dark:bg-slate-950">
      <div className="flex items-center justify-between"><h2 id="notification-title" className="text-lg font-bold">{settings ? "Notification preferences" : "Notifications"}</h2><div className="flex gap-1"><button type="button" onClick={() => { setSettings(!settings); if (!settings) void loadPreferences(); }} className="grid h-9 w-9 place-items-center" aria-label="Notification preferences"><Settings className="h-4 w-4" /></button><button ref={closeRef} type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="grid h-9 w-9 place-items-center" aria-label="Close notifications"><X className="h-5 w-5" /></button></div></div>
      {settings ? <div className="mt-5 overflow-y-auto"><NotificationPreferences values={preferences} onSaved={loadPreferences} /></div> : <><div className="mt-4 flex gap-2"><select aria-label="Filter by module" value={module} onChange={(e) => setModule(e.target.value as NotificationModule | "")} className="min-w-0 flex-1 rounded-md border border-brand-line bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="">All modules</option>{notificationModules.map((value) => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Filter by read status" value={read} onChange={(e) => setRead(e.target.value as typeof read)} className="rounded-md border border-brand-line bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="ALL">All</option><option value="UNREAD">Unread</option><option value="READ">Read</option></select></div><button type="button" onClick={markAllRead} className="mt-3 text-xs font-bold text-brand-navy dark:text-blue-200">Mark all read</button><div className="mt-2 flex-1 overflow-y-auto"><NotificationList items={page.items} onReadChange={setReadState} />{page.nextCursor ? <button type="button" disabled={loading} onClick={() => void load(page.nextCursor ?? undefined)} className="mt-4 w-full rounded-lg border border-brand-line py-2 text-sm font-bold disabled:opacity-50">{loading ? "Loading…" : "Load more"}</button> : null}</div></>}
    </section></div> : null}
  </>;
}
