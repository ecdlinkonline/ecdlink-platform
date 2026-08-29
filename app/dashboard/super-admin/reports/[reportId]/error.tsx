"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GrantReportError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle className="dark:text-white">Grant report unavailable</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-slate-600 dark:text-slate-300">The report workspace could not be loaded. No report data was changed.</p><div className="flex gap-3"><Button type="button" onClick={reset}>Try again</Button><Link href="/dashboard/super-admin/reports"><Button type="button" variant="secondary">Back to reports</Button></Link></div></CardContent></Card>;
}
