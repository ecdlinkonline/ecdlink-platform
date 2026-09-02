"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Landmark } from "lucide-react";
import { useToast } from "@/components/design-system";
import { Button } from "@/components/ui/button";

export function BankStatementImportAction({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function openImport() {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/grant-reports/${reportId}/bank-import`, { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.data?.id) throw new Error(result.error ?? "The bank statement import could not be opened.");
      router.push(`/dashboard/super-admin/reports/${reportId}/bank-import/${result.data.id}`);
    } catch (error) {
      pushToast({ title: "Bank import unavailable", description: error instanceof Error ? error.message : "The bank statement import could not be opened." });
      setLoading(false);
    }
  }

  return <Button type="button" variant="secondary" disabled={loading} onClick={() => void openImport()}><Landmark className="h-4 w-4" />{loading ? "Opening…" : "Import Bank Statements"}</Button>;
}
