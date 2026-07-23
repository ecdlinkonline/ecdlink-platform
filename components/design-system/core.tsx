"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  PackageCheck,
  Truck,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createContext, useContext, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <Badge variant="success">{eyebrow}</Badge> : null}
        <h1 className="mt-3 text-3xl font-bold text-brand-ink dark:text-white">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

export function KpiCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "navy"
}: {
  label: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  tone?: "navy" | "green" | "warning";
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 text-brand-green"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : "bg-blue-50 text-brand-navy";

  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold text-brand-ink dark:text-white">{value}</p>
            {description ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p> : null}
          </div>
          <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg", toneClass)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DataTable({
  columns,
  rows
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-brand-line text-slate-500 dark:border-slate-800">
            {columns.map((column) => (
              <th key={column} className="py-3 font-semibold">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-brand-line last:border-0 dark:border-slate-800">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="py-4 pr-4">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "red" || ["cancelled", "missing", "failed", "expired", "overdue", "not paid", "rejected", "critical", "high risk", "suspended", "archived", "out of stock"].some((item) => normalized.includes(item))) {
    return <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">{status}</span>;
  }
  if (normalized === "green" || ["active", "approved", "packed", "delivered", "available", "paid", "open", "verified", "ready", "submitted", "excellent", "good", "low risk", "compliant", "in stock", "featured", "completed"].some((item) => normalized.includes(item))) {
    return <Badge variant="success">{status}</Badge>;
  }
  if (normalized === "amber" || ["pending", "awaiting", "draft", "low", "out for delivery", "attention", "expiring soon", "uploaded", "in progress", "medium risk", "under review", "confirm date", "comparison", "scheduled"].some((item) => normalized.includes(item))) {
    return <Badge variant="warning">{status}</Badge>;
  }
  return <Badge>{status}</Badge>;
}

export function Alert({ title, description, tone = "info" }: { title: string; description?: string; tone?: "info" | "success" | "warning" }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? AlertTriangle : Info;
  const classes = tone === "success" ? "border-green-100 bg-green-50 text-brand-green" : tone === "warning" ? "border-amber-100 bg-amber-50 text-amber-800" : "border-blue-100 bg-blue-50 text-brand-navy";
  return (
    <div className={cn("flex gap-3 rounded-lg border p-4", classes)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-bold">{title}</p>
        {description ? <p className="mt-1 text-sm leading-6 opacity-90">{description}</p> : null}
      </div>
    </div>
  );
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-soft dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-ink dark:text-white">{title}</h2>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-brand-accent"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function Drawer({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50 bg-slate-950/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="ml-auto h-full w-full max-w-md bg-white p-5 shadow-soft dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-ink dark:text-white">{title}</h2>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-brand-accent"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4">{children}</div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800", className)} />;
}

type Toast = { id: number; title: string; description?: string };
const ToastContext = createContext<{ pushToast: (toast: Omit<Toast, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const value = useMemo(() => ({
    pushToast: (toast: Omit<Toast, "id">) => {
      const id = Date.now();
      setToasts((items) => [...items, { ...toast, id }]);
      window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3500);
    }
  }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="w-80 rounded-lg border border-brand-line bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <p className="font-bold text-brand-ink dark:text-white">{toast.title}</p>
            {toast.description ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{toast.description}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

export function ProductCard({ title, meta, price, status, children }: { title: string; meta: string; price: string; status: string; children?: React.ReactNode }) {
  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-brand-ink dark:text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{meta}</p>
          </div>
          <StatusBadge status={status} />
        </div>
        <p className="mt-4 text-xl font-bold text-brand-navy dark:text-blue-200">{price}</p>
        {children ? <div className="mt-4">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

export function CartSummary({ rows, total }: { rows: Array<{ label: string; value: string }>; total: string }) {
  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="dark:text-white">Cart summary</CardTitle>
        <CardDescription className="dark:text-slate-400">Review estimated totals before checkout.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">{row.label}</span>
            <span className="font-bold text-brand-ink dark:text-white">{row.value}</span>
          </div>
        ))}
        <div className="border-t border-brand-line pt-3 dark:border-slate-800">
          <div className="flex justify-between">
            <span className="font-bold text-brand-ink dark:text-white">Total</span>
            <span className="text-xl font-bold text-brand-navy dark:text-blue-200">{total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function InvoiceLayout({ invoiceNo, recipient, total, status }: { invoiceNo: string; recipient: string; total: string; status: string }) {
  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="dark:text-white">Invoice</CardTitle>
        <CardDescription className="dark:text-slate-400">PDF generation placeholder.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-brand-ink dark:text-white">{invoiceNo}</p>
              <p className="mt-1 text-sm text-slate-500">{recipient}</p>
            </div>
            <StatusBadge status={status} />
          </div>
          <div className="mt-5 flex justify-between border-t border-brand-line pt-4 dark:border-slate-800">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Amount</span>
            <span className="font-bold text-brand-navy dark:text-blue-200">{total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DeliveryTracker({ stages }: { stages: Array<{ label: string; complete: boolean }> }) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {stages.map((stage) => (
        <div key={stage.label} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
          <div className={cn("grid h-10 w-10 place-items-center rounded-lg", stage.complete ? "bg-green-50 text-brand-green" : "bg-slate-100 text-slate-500")}>
            {stage.complete ? <PackageCheck className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
          </div>
          <p className="mt-3 text-sm font-bold text-brand-ink dark:text-white">{stage.label}</p>
        </div>
      ))}
    </div>
  );
}

export function ActionRow({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-2 text-sm font-bold text-brand-navy dark:text-blue-200">
      {label}
      <ChevronRight className="h-4 w-4" />
    </a>
  );
}
