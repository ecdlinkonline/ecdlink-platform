"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Menu,
  Play,
  Printer,
  Quote,
  Search,
  Sparkles,
  X
} from "lucide-react";
import { useState } from "react";
import {
  dashboardRows,
  heroStats,
  navigation,
  roleCards,
  services,
  smartKidsItems,
  supplierLogos,
  testimonials,
  workflowSteps
} from "@/lib/data";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 }
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08
    }
  }
};

function Logo() {
  return (
    <a href="#" className="flex items-center gap-3" aria-label="ECDLink home">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-navy text-sm font-bold text-white shadow-panel">
        EL
      </span>
      <span className="text-xl font-bold text-brand-ink">ECDLink</span>
    </a>
  );
}

function ButtonLink({
  href,
  children,
  variant = "primary"
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "light";
}) {
  const styles = {
    primary: "bg-brand-navy text-white shadow-panel hover:-translate-y-0.5 hover:bg-blue-950",
    secondary: "border border-brand-line bg-white text-brand-ink hover:-translate-y-0.5 hover:border-brand-navy hover:text-brand-navy",
    light: "bg-white text-brand-navy shadow-panel hover:-translate-y-0.5 hover:bg-brand-accent"
  };

  return (
    <a
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition ${styles[variant]}`}
    >
      {children}
    </a>
  );
}

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-brand-line/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          {navigation.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-medium text-slate-600 hover:text-brand-navy">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <a href="#contact" className="text-sm font-semibold text-slate-700 hover:text-brand-navy">
            Contact
          </a>
          <ButtonLink href="#demo">Request demo</ButtonLink>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="grid h-11 w-11 place-items-center rounded-lg border border-brand-line text-brand-ink lg:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-brand-line bg-white px-4 py-4 lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-brand-accent"
              >
                {item.label}
              </a>
            ))}
            <ButtonLink href="#demo">Request demo</ButtonLink>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function AnimatedNetwork() {
  const reduceMotion = useReducedMotion();
  const centres = [
    { x: 16, y: 24, label: "Centre" },
    { x: 76, y: 22, label: "Supplier" },
    { x: 18, y: 72, label: "Donor" },
    { x: 79, y: 72, label: "Funder" },
    { x: 50, y: 10, label: "Compliance" },
    { x: 50, y: 86, label: "Reports" }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="relative mx-auto aspect-[1.05] w-full max-w-[560px] overflow-hidden rounded-2xl border border-brand-line bg-white p-4 shadow-soft"
      aria-label="Animated illustration of ECD centres connected through ECDLink"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(46,125,50,0.12),transparent_38%),linear-gradient(135deg,#ffffff,#F4F7FA)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" role="presentation">
        <defs>
          <linearGradient id="networkLine" x1="0" x2="1">
            <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#2E7D32" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {centres.map((point) => (
          <motion.line
            key={point.label}
            x1="50"
            y1="50"
            x2={point.x}
            y2={point.y}
            stroke="url(#networkLine)"
            strokeWidth="0.7"
            strokeDasharray="3 3"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, delay: 0.2 }}
          />
        ))}
      </svg>

      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="flex h-32 w-32 flex-col items-center justify-center rounded-2xl bg-brand-navy text-white shadow-panel"
        >
          <Sparkles className="h-7 w-7 text-green-200" />
          <span className="mt-2 text-lg font-bold">ECDLink</span>
          <span className="text-xs text-blue-100">Operating layer</span>
        </motion.div>
      </div>

      {centres.map((point, index) => (
        <div
          key={point.label}
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: reduceMotion ? 0 : [0, index % 2 === 0 ? 6 : -6, 0]
            }}
            transition={{
              opacity: { delay: 0.35 + index * 0.08, duration: 0.4 },
              scale: { delay: 0.35 + index * 0.08, duration: 0.4 },
              y: { duration: 4 + index * 0.3, repeat: Infinity, ease: "easeInOut" }
            }}
            className="rounded-xl border border-brand-line bg-white px-3 py-2 text-center shadow-panel"
          >
            <span className="block h-2 w-2 rounded-full bg-brand-green" />
            <span className="mt-1 block text-xs font-bold text-brand-ink">{point.label}</span>
          </motion.div>
        </div>
      ))}

      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          className="h-full w-full rounded-full border border-dashed border-brand-navy/20"
        />
      </div>
    </motion.div>
  );
}

function DashboardPreview() {
  return (
    <motion.div
      variants={fadeUp}
      className="relative rounded-2xl border border-brand-line bg-white p-3 shadow-soft"
    >
      <div className="overflow-hidden rounded-xl border border-brand-line bg-brand-accent">
        <div className="flex items-center justify-between border-b border-brand-line bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-brand-green" />
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-brand-line px-3 py-2 text-xs text-slate-500 sm:flex">
            <Search className="h-4 w-4" />
            Search centres, orders, reports
          </div>
        </div>
        <div className="grid lg:grid-cols-[210px_1fr]">
          <aside className="hidden border-r border-brand-line bg-white p-4 lg:block">
            {["Dashboard", "Centres", "Procurement", "Compliance", "Funding", "Reports"].map((item, index) => (
              <div
                key={item}
                className={`mb-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  index === 0 ? "bg-brand-navy text-white" : "text-slate-600"
                }`}
              >
                {item}
              </div>
            ))}
          </aside>
          <main className="p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-green">Network operations</p>
                <h2 className="text-2xl font-bold text-brand-ink">July procurement command centre</h2>
              </div>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-green px-4 text-sm font-semibold text-white">
                <Printer className="h-4 w-4" />
                Export
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Total centres", "16", "+4 this quarter"],
                ["Procurement value", "R248k", "July cycle"],
                ["Funding applications", "38", "11 under review"]
              ].map(([label, value, hint]) => (
                <div key={label} className="rounded-lg border border-brand-line bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-brand-ink">{value}</p>
                  <p className="mt-1 text-sm text-brand-green">{hint}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-lg border border-brand-line bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold text-brand-ink">Centre order pipeline</p>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-brand-green">
                    Live
                  </span>
                </div>
                <div className="space-y-3">
                  {dashboardRows.map((row) => (
                    <div
                      key={row.centre}
                      className="grid grid-cols-2 gap-3 rounded-lg bg-brand-accent p-3 text-sm sm:grid-cols-4"
                    >
                      <span className="font-semibold text-brand-ink">{row.centre}</span>
                      <span className="text-slate-600">{row.status}</span>
                      <span className="font-medium text-brand-navy">{row.budget}</span>
                      <span className="text-slate-600">{row.order}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-brand-line bg-white p-4">
                <p className="font-semibold text-brand-ink">Funding readiness</p>
                <div className="mt-5 space-y-4">
                  {["Compliance files", "Budget templates", "Project proposals", "Donor reports"].map((item, index) => (
                    <div key={item}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-slate-600">{item}</span>
                        <span className="font-semibold text-brand-ink">{92 - index * 10}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${92 - index * 10}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: index * 0.08 }}
                          className="h-2 rounded-full bg-brand-green"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </motion.div>
  );
}

function SectionIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.35 }}
      variants={fadeUp}
      transition={{ duration: 0.55 }}
      className="mx-auto max-w-3xl text-center"
    >
      <p className="text-sm font-bold uppercase text-brand-green">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold text-brand-ink sm:text-4xl">{title}</h2>
      <p className="mt-4 text-lg leading-8 text-slate-600">{text}</p>
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 grid-pattern" />
          <div className="absolute inset-x-0 top-0 -z-10 h-[680px] bg-[linear-gradient(180deg,#F4F7FA_0%,#FFFFFF_72%)]" />
          <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1fr_0.86fr] lg:items-center lg:px-8">
            <motion.div initial="hidden" animate="visible" variants={stagger}>
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm"
              >
                <Sparkles className="h-4 w-4 text-brand-green" />
                Digital infrastructure for South African ECD centres
              </motion.div>
              <motion.h1
                variants={fadeUp}
                className="mt-8 max-w-4xl text-4xl font-bold text-brand-ink sm:text-6xl lg:text-7xl"
              >
                Building the Operating System for Early Childhood Development Centres.
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                ECDLink connects centres, suppliers, donors and funding organisations through one trusted platform for
                procurement, compliance support, funding readiness and measurable impact.
              </motion.p>
              <motion.div id="demo" variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="#contact">
                  Request investor demo
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href="#services" variant="secondary">
                  Explore services
                  <ChevronRight className="h-4 w-4" />
                </ButtonLink>
              </motion.div>
            </motion.div>
            <AnimatedNetwork />
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mx-auto grid max-w-7xl gap-3 px-4 pb-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8"
          >
            {heroStats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                className="rounded-lg border border-brand-line bg-white/95 p-5 shadow-sm"
              >
                <p className="text-3xl font-bold text-brand-navy">{stat.value}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section id="services" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="Services"
              title="Four services that turn centre operations into a scalable network"
              text="ECDLink gives centres practical support while creating reliable data, reporting and coordination for the wider ECD ecosystem."
            />
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
              className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            >
              {services.map((service) => (
                <motion.div
                  key={service.title}
                  variants={fadeUp}
                  whileHover={{ y: -6 }}
                  className="rounded-lg border border-brand-line bg-white p-6 shadow-sm"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-blue-50 text-brand-navy">
                    <service.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-brand-ink">{service.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{service.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="how-it-works" className="bg-brand-accent px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="How ECDLink Works"
              title="From fragmented admin to one connected operating layer"
              text="The platform standardises the monthly rhythm of ECD operations while keeping every participant focused on their own workflow."
            />
            <div className="mt-12 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={stagger}
                className="space-y-4"
              >
                {workflowSteps.map((step, index) => (
                  <motion.div key={step.title} variants={fadeUp} className="flex gap-4 rounded-lg bg-white p-5 shadow-sm">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-navy text-white">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-green">Step {index + 1}</p>
                      <h3 className="mt-1 font-bold text-brand-ink">{step.title}</h3>
                      <p className="mt-1 leading-7 text-slate-600">{step.text}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
              <DashboardPreview />
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="Portals"
              title="Role-specific workspaces for every partner"
              text="Super admins, centres, suppliers, donors and funders get focused interfaces without losing the shared source of truth."
            />
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
              className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-5"
            >
              {roleCards.map((card) => (
                <motion.div key={card.title} variants={fadeUp} className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-green-50 text-brand-green">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-bold text-brand-ink">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="smartkids" className="bg-brand-navy px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <p className="text-sm font-bold uppercase text-green-200">SmartKids TV</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                A media layer for stories, competitions, events and announcements.
              </h2>
              <p className="mt-4 text-lg leading-8 text-blue-100">
                SmartKids TV gives the ECDLink network a human voice, helping centres share progress while keeping
                donors and partners close to the impact.
              </p>
              <div className="mt-8">
                <ButtonLink href="#contact" variant="light">
                  Launch content hub
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              </div>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
              className="grid gap-4 sm:grid-cols-3"
            >
              {smartKidsItems.map((item) => (
                <motion.div key={item.title} variants={fadeUp} className="rounded-lg bg-white p-4 text-brand-ink">
                  <div className="grid aspect-video place-items-center rounded-lg bg-brand-accent text-brand-navy">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-brand-green shadow-sm">
                      <Play className="ml-1 h-6 w-6 fill-current" />
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <item.icon className="h-5 w-5 text-brand-green" />
                    <p className="font-bold">{item.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-center text-sm font-bold uppercase text-slate-500">
              Supplier network
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {supplierLogos.map((logo) => (
                <div
                  key={logo}
                  className="grid min-h-20 place-items-center rounded-lg border border-brand-line bg-white px-4 text-center text-sm font-bold text-slate-500 shadow-sm"
                >
                  {logo}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="donors" className="bg-brand-accent px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <p className="text-sm font-bold uppercase text-brand-green">Donor / CSI Partners</p>
              <h2 className="mt-3 text-3xl font-bold text-brand-ink sm:text-4xl">
                Fund verified centres with clearer visibility and better reporting.
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Donors can browse verified centres, support active projects, track impact and download reports for
                internal CSI and board reporting.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {["Verified centre profiles", "Active project pipeline", "Donation tracking", "Impact reporting"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
                    <CheckCircle2 className="h-5 w-5 text-brand-green" />
                    <span className="font-semibold text-brand-ink">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="rounded-2xl border border-brand-line bg-white p-4 shadow-panel"
            >
              <div className="rounded-xl bg-brand-navy p-5 text-white">
                <div className="flex items-center justify-between">
                  <p className="font-bold">CSI impact portfolio</p>
                  <CircleDollarSign className="h-6 w-6 text-green-200" />
                </div>
                <p className="mt-6 text-4xl font-bold">R1.2m</p>
                <p className="mt-1 text-blue-100">Potential annual support tracked through ECDLink</p>
              </div>
              <div className="mt-4 space-y-3">
                {["Nutrition support", "Learning materials", "Compliance upgrades"].map((item, index) => (
                  <div key={item} className="rounded-lg border border-brand-line p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-brand-ink">{item}</p>
                      <span className="text-sm font-bold text-brand-green">{8 + index * 3} centres</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-brand-green" style={{ width: `${62 + index * 12}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="testimonials" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="Testimonials"
              title="Built around the realities of ECD operations"
              text="ECDLink is designed for the people who run centres, supply them, fund them and need to report on their progress."
            />
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
              className="mt-12 grid gap-4 lg:grid-cols-3"
            >
              {testimonials.map((item) => (
                <motion.figure key={item.name} variants={fadeUp} className="rounded-lg border border-brand-line bg-white p-6 shadow-sm">
                  <Quote className="h-8 w-8 text-brand-green" />
                  <blockquote className="mt-5 text-lg leading-8 text-brand-ink">{item.quote}</blockquote>
                  <figcaption className="mt-6 border-t border-brand-line pt-4">
                    <p className="font-bold text-brand-ink">{item.name}</p>
                    <p className="text-sm text-slate-500">{item.role}</p>
                  </figcaption>
                </motion.figure>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="contact" className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl bg-brand-navy px-6 py-12 text-center text-white shadow-soft sm:px-10">
            <div className="mx-auto max-w-3xl">
              <p className="text-sm font-bold uppercase text-green-200">Nationwide rollout</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                Ready to scale ECDLink across South Africa?
              </h2>
              <p className="mt-4 text-lg leading-8 text-blue-100">
                Build the digital operating layer for centres, suppliers, funders and CSI partners with workflows that
                produce measurable operational data.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <a
                  href="mailto:hello@ecdlink.co.za"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-bold text-brand-navy transition hover:bg-brand-accent"
                >
                  Request demo
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/20 px-5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  See how it works
                  <FileText className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-brand-line px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <p>Procurement, compliance, funding and impact infrastructure for ECD centres.</p>
        </div>
      </footer>
    </div>
  );
}
