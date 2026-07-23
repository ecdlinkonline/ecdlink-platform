"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Bell, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardConfig, getRoleNavigation, hasPermission } from "@/config/dashboard";
import type { UserRole } from "@/lib/auth/roles";

const permissionHighlights = [
  "procurement:manage",
  "procurement:read",
  "funding:manage",
  "funding:read",
  "compliance:manage",
  "compliance:read",
  "reports:read",
  "messages:read"
] as const;

export function DashboardLanding({ role }: { role: UserRole }) {
  const config = getDashboardConfig(role);
  const navigation = getRoleNavigation(role);
  const RoleIcon = config.icon;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-brand-navy p-6 text-white sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <Badge variant="success" className="bg-white text-brand-green">
                {config.eyebrow}
              </Badge>
              <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{config.title}</h1>
              <p className="mt-3 max-w-3xl leading-8 text-blue-100">{config.description}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-white text-brand-navy">
                  <RoleIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold">{config.label}</p>
                  <p className="text-sm text-blue-100">Role-based workspace</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {config.cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <Link href={card.href}>
              <Card className="h-full transition hover:border-brand-navy hover:shadow-panel dark:border-slate-800 dark:bg-slate-900">
                <CardContent className="p-5">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-brand-navy dark:bg-slate-800 dark:text-blue-200">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-sm font-semibold text-slate-500 dark:text-slate-400">{card.title}</p>
                  <p className="mt-2 text-2xl font-bold text-brand-ink dark:text-white">{card.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{card.description}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Workspace modules</CardTitle>
            <CardDescription className="dark:text-slate-400">
              Role-based menu items available to this user.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-brand-line p-4 transition hover:border-brand-navy hover:bg-brand-accent dark:border-slate-800 dark:hover:bg-slate-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-brand-navy dark:bg-slate-800 dark:text-blue-200">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-brand-ink dark:text-white">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.permission ?? "Core access"}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <ShieldCheck className="h-5 w-5 text-brand-green" />
                Permissions
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Access is filtered before users reach each module.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {permissionHighlights.map((permission) =>
                hasPermission(role, permission) ? (
                  <Badge key={permission} variant="success">
                    {permission}
                  </Badge>
                ) : null
              )}
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <Bell className="h-5 w-5 text-amber-600" />
                Notifications
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Shared notification surface for future module events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {["Module alerts", "Approval requests", "Document reminders"].map((item) => (
                <div key={item} className="rounded-lg border border-brand-line p-3 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
