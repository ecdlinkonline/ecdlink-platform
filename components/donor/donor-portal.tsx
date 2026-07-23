"use client";

import { useState } from "react";
import { BarChart } from "@/components/charts/bar-chart";
import { Alert, DataTable, KpiCard, PageHeader, StatusBadge, useToast } from "@/components/design-system";
import { ProjectCard } from "@/components/donor/project-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Building2, Camera, FileText, HandHeart, MessageSquare, UsersRound } from "lucide-react";
import { formatDonorCurrency } from "@/lib/donor/format";
import type { DonorReport, ImpactCentre, ImpactProject, PartnerMessage, PartnerOrganisation } from "@/lib/donor/types";

const tabs = ["Dashboard", "Centre Directory", "Projects", "Reports", "Messages", "Partner Profile"] as const;
export type DonorTab = (typeof tabs)[number];

export function DonorPortal({
  centres,
  projects,
  partners,
  messages,
  reports,
  initialTab = "Dashboard"
}: {
  centres: ImpactCentre[];
  projects: ImpactProject[];
  partners: PartnerOrganisation[];
  messages: PartnerMessage[];
  reports: DonorReport;
  initialTab?: DonorTab;
}) {
  const [activeTab, setActiveTab] = useState<DonorTab>(initialTab);
  const { pushToast } = useToast();
  const currentPartner = partners[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Impact & Partnership Portal"
        title="Donor / CSI Partner Workspace"
        description="Discover verified ECD centres, review projects, request proposals, track impact and coordinate partnership conversations."
      />

      <Alert title="Sponsorship and payment placeholders" description="This is an impact and partnership platform. Payment gateway and direct crowdfunding flows are intentionally not integrated." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Verified Centres" value={String(reports.totalVerifiedCentres)} description="ECDLink verified profiles" icon={Building2} />
        <KpiCard label="Need Support" value={String(reports.centresNeedingSupport)} description="Centres with active needs" icon={HandHeart} tone="warning" />
        <KpiCard label="Active Projects" value={String(reports.activeProjects)} description="Partner-ready projects" icon={FileText} tone="green" />
        <KpiCard label="Children Reached" value={String(reports.childrenReached)} description="Across verified centres" icon={UsersRound} tone="green" />
        <KpiCard label="Impact Pipeline" value={formatDonorCurrency(reports.totalImpact)} description="Funds allocated placeholder" icon={HandHeart} />
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-lg border border-brand-line bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${activeTab === tab ? "bg-brand-navy text-white" : "text-slate-600 hover:bg-brand-accent dark:text-slate-300"}`}>{tab}</button>
        ))}
      </div>

      {activeTab === "Dashboard" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Latest updates</CardTitle><CardDescription className="dark:text-slate-400">Project updates, photos and partner activity.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {projects.slice(0, 5).map((project) => (
                <div key={project.id} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3"><p className="font-bold text-brand-ink dark:text-white">{project.title}</p><StatusBadge status={project.status} /></div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{project.impact}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-white">Funding pipeline</CardTitle><CardDescription className="dark:text-slate-400">Project budgets prepared for partner review.</CardDescription></CardHeader>
            <CardContent><BarChart data={reports.fundingPipeline} /></CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "Centre Directory" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {centres.map((centre) => (
            <Card key={centre.id} className="overflow-hidden dark:border-slate-800 dark:bg-slate-900">
              <div className={`grid h-32 place-items-center ${centre.imageTone}`}><Camera className="h-8 w-8 text-brand-navy" /></div>
              <CardContent className="p-5">
                <h3 className="font-bold text-brand-ink dark:text-white">{centre.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{centre.location}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-slate-500">Children</p><p className="font-bold">{centre.children}</p></div>
                  <div><p className="text-slate-500">Staff</p><p className="font-bold">{centre.staff}</p></div>
                  <div><p className="text-slate-500">Compliance</p><p className="font-bold text-brand-green">{centre.complianceScore}%</p></div>
                  <div><p className="text-slate-500">Funding</p><p className="font-bold text-brand-navy">{centre.fundingReadiness}%</p></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2"><StatusBadge status={centre.registrationStatus} /><StatusBadge status={centre.membershipStatus} /></div>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Needs: {centre.currentNeeds.join(", ")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {activeTab === "Projects" ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : null}

      {activeTab === "Reports" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle className="dark:text-white">Top viewed centres</CardTitle></CardHeader><CardContent><BarChart data={reports.topViewedCentres} /></CardContent></Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle className="dark:text-white">Most funded categories</CardTitle></CardHeader><CardContent><BarChart data={reports.mostFundedCategories} /></CardContent></Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle className="dark:text-white">Projects by province</CardTitle></CardHeader><CardContent><BarChart data={reports.projectsByProvince} /></CardContent></Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle className="dark:text-white">Corporate engagement</CardTitle></CardHeader><CardContent><BarChart data={reports.corporateEngagement} /></CardContent></Card>
        </div>
      ) : null}

      {activeTab === "Messages" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Secure messaging placeholders</CardTitle><CardDescription className="dark:text-slate-400">ECDLink, donor/CSI partner and centre conversations.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3"><p className="font-bold text-brand-ink dark:text-white">{message.subject}</p><StatusBadge status={message.from} /></div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message.preview}</p>
                <p className="mt-2 text-xs text-slate-500">{message.createdAt}</p>
              </div>
            ))}
            <Button onClick={() => pushToast({ title: "Message placeholder", description: "Secure messaging will connect ECDLink, partners and centres." })}><MessageSquare className="h-4 w-4" /> New message</Button>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "Partner Profile" ? (
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader><CardTitle className="dark:text-white">Partner profile</CardTitle><CardDescription className="dark:text-slate-400">Organisation profile and partnership preferences.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["Organisation", currentPartner.name],
              ["Type", currentPartner.type],
              ["Contact", currentPartner.contactPerson],
              ["Email", currentPartner.email],
              ["Status", currentPartner.status],
              ["Focus areas", currentPartner.focusAreas.join(", ")]
            ].map(([label, value]) => <div key={label} className="rounded-lg border border-brand-line p-4 dark:border-slate-800"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-1 font-bold text-brand-ink dark:text-white">{value}</p></div>)}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
