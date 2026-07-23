"use client";

import Link from "next/link";
import { Bookmark, CalendarDays, HandHeart, MessageSquare } from "lucide-react";
import { StatusBadge, useToast } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDonorCurrency } from "@/lib/donor/format";
import type { ImpactProject } from "@/lib/donor/types";

export function ProjectCard({ project }: { project: ImpactProject }) {
  const { pushToast } = useToast();
  return (
    <Card className="overflow-hidden dark:border-slate-800 dark:bg-slate-900">
      <div className={`grid h-32 place-items-center ${project.photos[0]?.tone ?? "bg-blue-100"}`}>
        <HandHeart className="h-8 w-8 text-brand-navy" />
      </div>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-brand-ink dark:text-white">{project.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{project.centreName} | {project.province}</p>
          </div>
          <StatusBadge status={project.status} />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{project.description}</p>
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-semibold text-slate-500">Progress</span>
            <span className="font-bold text-brand-navy dark:text-blue-200">{project.progress}% of {formatDonorCurrency(project.budget)}</span>
          </div>
          <Progress value={project.progress} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/dashboard/donor/projects/${project.id}`}><Button variant="secondary" className="min-h-9 px-3">View project</Button></Link>
          <Button variant="ghost" className="min-h-9 px-3" onClick={() => pushToast({ title: "Bookmarked", description: `${project.title} saved to partner profile.` })}><Bookmark className="h-4 w-4" /></Button>
          <Button variant="ghost" className="min-h-9 px-3" onClick={() => pushToast({ title: "Meeting request placeholder", description: "ECDLink will coordinate partner, centre and ECDLink messaging." })}><MessageSquare className="h-4 w-4" /></Button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500"><CalendarDays className="h-4 w-4" /> {project.timeline}</div>
      </CardContent>
    </Card>
  );
}
