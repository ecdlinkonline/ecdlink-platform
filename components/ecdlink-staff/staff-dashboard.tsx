"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Bell, Building2, CalendarDays, ClipboardCheck, ClipboardList, FileText, MessageSquare, Plus, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StaffDashboardData } from "@/lib/ecdlink-staff/dashboard";

const statIcons = [Building2, CalendarDays, ClipboardList, UsersRound, ClipboardCheck, Bell, MessageSquare];

function modeLabel(mode: string) {
  return mode
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StaffDashboard({ data }: { data: StaffDashboardData }) {
  const [quickAction, setQuickAction] = useState<string | null>(null);
  const statRows = [
    ["Assigned Centres", data.stats.assignedCentres],
    ["Today's Sessions", data.stats.todaysSessions],
    ["Open Tasks", data.stats.openTasks],
    ["Support Cases", data.stats.supportCases],
    ["Compliance Reviews", data.stats.complianceReviews],
    ["Upcoming Events", data.stats.upcomingEvents],
    ["Unread Messages", data.stats.unreadMessages]
  ] as const;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <Badge variant="success">{data.staff.departmentLabel}</Badge>
            <h1 className="mt-4 text-3xl font-bold text-brand-ink dark:text-white sm:text-4xl">Good Morning, {data.staff.firstName}</h1>
            <p className="mt-3 max-w-3xl leading-8 text-slate-600 dark:text-slate-300">Here is what needs your attention across your assigned work.</p>
          </div>
          <div className="rounded-lg border border-brand-line bg-brand-accent p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Role focus</p>
            <p className="mt-2 font-bold text-brand-ink dark:text-white">{data.staff.jobTitle}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{data.staff.departmentFocus}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {statRows.map(([label, value], index) => {
          const Icon = statIcons[index];
          return (
            <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
              <Card className="h-full dark:border-slate-800 dark:bg-slate-900">
                <CardContent className="p-5">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-brand-navy dark:bg-slate-800 dark:text-blue-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-2xl font-bold text-brand-ink dark:text-white">{value}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Today&apos;s Priorities</CardTitle>
            <CardDescription className="dark:text-slate-400">Department-aware actions for your current staff role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.priorities.map((priority, index) => (
              <div key={priority} className="flex items-center gap-3 rounded-lg border border-brand-line p-4 dark:border-slate-800">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-navy text-sm font-bold text-white">{index + 1}</span>
                <p className="font-semibold text-brand-ink dark:text-white">{priority}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Upcoming Sessions</CardTitle>
            <CardDescription className="dark:text-slate-400">Session records will connect to the staff scheduling module next.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.sessions.map((session) => (
              <div key={session.id} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-brand-ink dark:text-white">{session.title}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{session.centreName}</p>
                  </div>
                  <Badge>{session.time}</Badge>
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-brand-green">{modeLabel(session.mode)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="dark:text-white">My Assigned Centres</CardTitle>
              <CardDescription className="dark:text-slate-400">Showing up to five active centre assignments.</CardDescription>
            </div>
            <Link
              href="/ecdlink/centres"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-brand-line bg-white px-4 text-sm font-bold text-brand-ink transition hover:border-brand-navy hover:text-brand-navy dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {data.assignedCentres.map((centre) => (
              <Link
                key={centre.id}
                href={`/ecdlink/centres?centre=${centre.slug}`}
                className="rounded-lg border border-brand-line p-4 transition hover:border-brand-navy hover:bg-brand-accent dark:border-slate-800 dark:hover:bg-slate-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-brand-ink dark:text-white">{centre.name}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {centre.region} - {centre.principal}
                    </p>
                  </div>
                  {centre.isPrimary ? <Badge variant="success">Primary</Badge> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span>{centre.children} children</span>
                  <span>{centre.role}</span>
                  <span>{centre.complianceStatus.replaceAll("_", " ")}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Quick Actions</CardTitle>
              <CardDescription className="dark:text-slate-400">These workflows open in the next staff sprint.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {["Create session note", "Add follow-up task", "Upload field document", "Send centre message"].map((action) => (
                <Button key={action} type="button" variant="secondary" className="justify-start" onClick={() => setQuickAction(action)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {action}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recentActivity.map((activity) => (
                <div key={activity} className="flex gap-3 rounded-lg bg-brand-accent p-3 text-sm font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                  <FileText className="h-4 w-4 text-brand-navy dark:text-blue-200" />
                  {activity}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {quickAction ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-brand-ink dark:text-white">{quickAction}</h2>
                <p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">
                  This action is reserved for the next staff workflow sprint. The route and permissions are ready.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickAction(null)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-brand-line dark:border-slate-800"
                aria-label="Close quick action dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
