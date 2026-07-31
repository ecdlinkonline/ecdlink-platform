"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
   CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
CreditCard,
FileCheck2,
ShoppingCart,
  Landmark,
  Network,
  PackageCheck,
   ShieldCheck,
  Target,
  TrendingUp,
  Truck,
  Users,
  WalletCards
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { SuperAdminDashboardData } from "@/lib/dashboard/super-admin-dashboard";

const ecosystemHealth = [
  {
    title: "Active Centres",
    value: "16",
    description: "Affiliated ECD centres",
    href: "/dashboard/super-admin/centres",
    icon: Building2
  },
  {
    title: "ECD Forums",
    value: "2",
    description: "Connected centre networks",
    href: "/dashboard/super-admin/partners",
    icon: Network
  },
  {
    title: "Children Supported",
    value: "1,120",
    description: "Across the ECDLink network",
    href: "/dashboard/super-admin/centres",
    icon: Users
  },
  {
    title: "Compliance",
    value: "92%",
    description: "Average network readiness",
    href: "/dashboard/super-admin/compliance",
    icon: ShieldCheck
  },
  {
    title: "Suppliers",
    value: "18",
    description: "Active service providers",
    href: "/dashboard/super-admin/suppliers",
    icon: Truck
  },
  {
    title: "Funding Partners",
    value: "7",
    description: "Funding and CSI relationships",
    href: "/dashboard/super-admin/funding",
    icon: WalletCards
  },
  {
    title: "Government Partners",
    value: "4",
    description: "Public-sector relationships",
    href: "/dashboard/super-admin/partners",
    icon: Landmark
  },
  {
    title: "Monthly Procurement",
    value: "R248k",
    description: "Current coordinated value",
    href: "/dashboard/super-admin/procurement",
    icon: PackageCheck
  }
];

const priorities = [
  {
    level: "Urgent",
    title: "Three centres require compliance attention",
    description: "Review documents that are missing or nearing expiry.",
    action: "Review compliance",
    href: "/dashboard/super-admin/compliance",
    icon: AlertTriangle
  },
  {
    level: "Due soon",
    title: "Monthly procurement closes in two days",
    description: "Confirm outstanding centre orders and payments.",
    action: "Review orders",
    href: "/dashboard/super-admin/procurement",
    icon: PackageCheck
  },
  {
    level: "Opportunity",
    title: "New funding opportunities match eight centres",
    description: "Review eligibility and assign applications.",
    action: "View funding",
    href: "/dashboard/super-admin/funding",
    icon: WalletCards
  }
];

type SuperAdminCommandCentreProps = {
  dashboard?: SuperAdminDashboardData;
};
const executivePerformance = [
  {
    title: "Membership Revenue",
    value: "R20,000",
    change: "+14%",
    description: "Annual affiliation and membership income",
    target: "Target: R25,000",
    progress: 80,
    href: "/dashboard/super-admin/memberships",
    icon: CircleDollarSign
  },
  {
    title: "Monthly Procurement",
    value: "R248,000",
    change: "+21%",
    description: "Total coordinated procurement value",
    target: "Target: R300,000",
    progress: 83,
    href: "/dashboard/super-admin/procurement",
    icon: PackageCheck
  },
  {
    title: "Centre Growth",
    value: "16 Centres",
    change: "+4 this quarter",
    description: "Active centres affiliated with ECDLink",
    target: "Annual target: 40",
    progress: 40,
    href: "/dashboard/super-admin/centres",
    icon: Building2
  },
  {
    title: "Funding Success",
    value: "67%",
    change: "12 approved",
    description: "Successful applications from 18 submissions",
    target: "Target: 75%",
    progress: 67,
    href: "/dashboard/super-admin/funding",
    icon: Target
  }
];
const ecosystemActivity = [
  {
    time: "02:48",
    actor: "Morning Star ECD Centre",
    action: "submitted a procurement order",
    category: "Procurement",
    icon: ShoppingCart,
    href: "/dashboard/super-admin/procurement"
  },
  {
    time: "02:31",
    actor: "Bokang ECD Centre",
    action: "renewed its annual membership",
    category: "Membership",
    icon: CreditCard,
    href: "/dashboard/super-admin/memberships"
  },
  {
    time: "02:14",
    actor: "Ubuntu Fresh Foods",
    action: "confirmed a scheduled delivery",
    category: "Supplier",
    icon: Truck,
    href: "/dashboard/super-admin/suppliers"
  },
  {
    time: "01:56",
    actor: "Department of Social Development",
    action: "uploaded a compliance inspection report",
    category: "Compliance",
    icon: FileCheck2,
    href: "/dashboard/super-admin/compliance"
  },
  {
    time: "01:38",
    actor: "ECDLink Funding Desk",
    action: "approved a centre funding application",
    category: "Funding",
    icon: CircleDollarSign,
    href: "/dashboard/super-admin/funding"
  }
];

export function SuperAdminCommandCentre({
  dashboard,
}: SuperAdminCommandCentreProps) {

  const currentHour = new Date().getHours();

const greeting =
  currentHour < 12
    ? "Good Morning"
    : currentHour < 18
    ? "Good Afternoon"
    : "Good Evening";

const briefingTitle =
  currentHour < 12
    ? "AI Morning Briefing"
    : currentHour < 18
    ? "AI Afternoon Briefing"
    : "AI Evening Briefing";

const liveExecutivePerformance = executivePerformance.map((item) => {
  if (item.title === "Membership Revenue") {
    const metric = dashboard?.metrics.membershipRevenue;

    return {
      ...item,
      value: `R${(metric?.value ?? 0).toLocaleString("en-ZA")}`,
      target: `Target: R${(metric?.target ?? 0).toLocaleString("en-ZA")}`,
      progress: metric?.progress ?? 0,
    };
  }

  if (item.title === "Monthly Procurement") {
    const metric = dashboard?.metrics.monthlyProcurement;

    return {
      ...item,
      value: `R${(metric?.value ?? 0).toLocaleString("en-ZA")}`,
      target: `Target: R${(metric?.target ?? 0).toLocaleString("en-ZA")}`,
      progress: metric?.progress ?? 0,
    };
  }

  if (item.title === "Centre Growth") {
    const metric = dashboard?.metrics.centreGrowth;

    return {
      ...item,
      title: "Active Centres",
      value: `${metric?.value ?? 0} Centres`,
      change: "Live from database",
      target: `Annual target: ${metric?.target ?? 40}`,
      progress: metric?.progress ?? 0,
    };
  }

  if (item.title === "Funding Success") {
    const metric = dashboard?.metrics.fundingSuccess;

    return {
      ...item,
      value: `${metric?.value ?? 0}%`,
      change: `${metric?.approved ?? 0} approved`,
      description: `Successful applications from ${metric?.submitted ?? 0} submissions`,
      target: `Target: ${metric?.target ?? 75}%`,
      progress: metric?.progress ?? 0,
    };
  }

  return item;
});
const currentDate = new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-brand-line bg-brand-navy text-white shadow-soft dark:border-slate-800">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <Badge variant="success" className="bg-white text-brand-green">
              ECDLink Internal Operations
            </Badge>

            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
              ECDLink Command Centre
            </h1>

            <p className="mt-3 text-xl font-semibold text-blue-100">
              {greeting}, Mandla 👋
            </p>

            <p className="mt-2 max-w-3xl leading-7 text-blue-100">
              Building the operating system for the Early Childhood Development
              ecosystem.
            </p>

            <p className="mt-4 text-sm font-semibold text-blue-200">
              {currentDate}
            </p>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-white text-brand-navy">
                <Bot className="h-6 w-6" />
              </div>

              <div>
                <p className="font-bold">{briefingTitle}</p>
                <p className="text-sm text-blue-100">
  Your ecosystem summary
</p>

<p className="mt-1 text-xs text-blue-200">
  Last updated: {new Date().toLocaleTimeString("en-ZA")}
</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-blue-50">
              Sixteen centres are active. Three centres need compliance
              attention, procurement closes in two days, and two funding
              opportunities match eight affiliated centres.
            </p>

            <Link
              href="/dashboard/super-admin/intelligence"
              className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white"
            >
              Open intelligence
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section>
        <section>
  <div className="mb-4 flex items-end justify-between">
    <div>
      <h2 className="text-xl font-bold text-brand-ink dark:text-white">
        Live Ecosystem Activity
      </h2>

      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Real-time activity happening across the ECDLink ecosystem.
      </p>
    </div>

    <Badge variant="muted">Live Feed</Badge>
  </div>

  <Card className="dark:border-slate-800 dark:bg-slate-900">
    <CardContent className="p-0">
      {ecosystemActivity.map((activity, index) => {
  const ActivityIcon = activity.icon;

  return (
        <Link
          key={`${activity.time}-${activity.actor}`}
          href={activity.href}
          className="block transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
        >
          <div className="flex items-center gap-4 p-5">
            <div className="flex min-w-[100px] items-center gap-3">
  <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-brand-green dark:bg-emerald-950/40 dark:text-emerald-300">
    <ActivityIcon className="h-4 w-4" />
  </div>

  <span className="text-sm font-semibold text-brand-green">
    {activity.time}
  </span>
</div>

            <div className="flex-1">
              <p className="font-semibold text-brand-ink dark:text-white">
                {activity.actor}
              </p>

              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {activity.action}
              </p>
            </div>

            <Badge variant="muted">
              {activity.category}
            </Badge>
          </div>

          {index < ecosystemActivity.length - 1 && (
            <div className="mx-5 border-b border-slate-200 dark:border-slate-800" />
          )}
        </Link>
            );
    })}
    </CardContent>
  </Card>
</section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-brand-ink dark:text-white">
            Today&apos;s Priorities
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The most important actions requiring attention.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {priorities.map((priority) => {
            const PriorityIcon = priority.icon;

            return (
              <Card
                key={priority.title}
                className="dark:border-slate-800 dark:bg-slate-900"
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      <PriorityIcon className="h-5 w-5" />
                    </div>

                    <div>
                      <Badge variant="muted">{priority.level}</Badge>

                      <h3 className="mt-3 font-bold text-brand-ink dark:text-white">
                        {priority.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {priority.description}
                      </p>

                      <Link
                        href={priority.href}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-navy dark:text-blue-200"
                      >
                        {priority.action}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
<section>
  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 className="flex items-center gap-2 text-xl font-bold text-brand-ink dark:text-white">
        <TrendingUp className="h-5 w-5 text-brand-green" />
        Executive Performance
      </h2>

      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Key indicators showing how ECDLink is performing as a business.
      </p>
    </div>

    <Badge variant="muted">ECDLink v2.1.0</Badge>
  </div>

  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {liveExecutivePerformance.map((metric) => {
      const MetricIcon = metric.icon;

      return (
        <Link key={metric.title} href={metric.href}>
          <Card className="h-full transition hover:border-brand-navy hover:shadow-panel dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-brand-green dark:bg-emerald-950/40 dark:text-emerald-300">
                  <MetricIcon className="h-5 w-5" />
                </div>

                <Badge variant="success">{metric.change}</Badge>
              </div>

              <p className="mt-5 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {metric.title}
              </p>

              <p className="mt-2 text-2xl font-bold text-brand-ink dark:text-white">
                {metric.value}
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {metric.description}
              </p>

              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs font-semibold">
  <span>{metric.target}</span>
  <span>{Math.round(metric.progress)}%</span>
</div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-brand-green"
                    style={{ width: `${metric.progress}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      );
    })}
  </div>
</section>
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-brand-ink dark:text-white">
            Ecosystem Health
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            A live overview of the ECDLink network.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ecosystemHealth.map((item) => {
            const ItemIcon = item.icon;

            return (
              <Link key={item.title} href={item.href}>
                <Card className="h-full transition hover:border-brand-navy hover:shadow-panel dark:border-slate-800 dark:bg-slate-900">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-brand-navy dark:bg-slate-800 dark:text-blue-200">
                        <ItemIcon className="h-5 w-5" />
                      </div>

                      <CheckCircle2 className="h-5 w-5 text-brand-green" />
                    </div>

                    <p className="mt-5 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      {item.title}
                    </p>

                    <p className="mt-2 text-2xl font-bold text-brand-ink dark:text-white">
                      {item.value}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="dark:text-white">
            Command Centre Status
          </CardTitle>
          <CardDescription className="dark:text-slate-400">
            ECDLink systems are operational and ready.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-3 sm:grid-cols-3">
          {["Platform operational", "Database connected", "Notifications online"].map(
            (status) => (
              <div
                key={status}
                className="flex items-center gap-3 rounded-lg border border-brand-line p-4 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200"
              >
                <CheckCircle2 className="h-5 w-5 text-brand-green" />
                {status}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
