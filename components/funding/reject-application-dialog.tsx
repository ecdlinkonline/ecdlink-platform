"use client";

import { CircleX } from "lucide-react";
import { useRouter } from "next/navigation";
import { WorkflowActionDialog, type WorkflowActionResult } from "@/components/workflows/workflow-action-dialog";

type RejectApplicationValues = {
  rejectionReason: string;
  internalNotes: string;
};

export function RejectApplicationDialog({ applicationId, applicationNumber }: { applicationId: string; applicationNumber: string }) {
  const router = useRouter();

  return (
    <WorkflowActionDialog<RejectApplicationValues>
      title="Reject application"
      description={`Record the reason for rejecting ${applicationNumber}. This decision cannot be reversed.`}
      trigger={{ label: "Reject", variant: "secondary", icon: <CircleX className="h-4 w-4" /> }}
      confirmationButton={{ label: "Reject Application", loadingLabel: "Rejecting…", tone: "danger" }}
      fields={[
        { name: "rejectionReason", type: "textarea", label: "Rejection Reason", rows: 5, required: true },
        { name: "internalNotes", type: "textarea", label: "Internal Notes", rows: 4 },
      ]}
      initialValues={{ rejectionReason: "", internalNotes: "" }}
      action={async (values): Promise<WorkflowActionResult> => {
        const response = await fetch(`/api/funding/applications/${applicationId}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Rejected",
            rejectionReason: values.rejectionReason.trim(),
            notes: values.internalNotes.trim() || undefined,
          }),
        });
        const result = await response.json() as { ok?: boolean; error?: string };
        return response.ok && result.ok
          ? { ok: true }
          : { ok: false, error: result.error ?? "The application could not be rejected." };
      }}
      successToast={{ title: "Application rejected", description: `${applicationNumber} has been rejected.` }}
      errorToast={{ title: "Rejection failed", fallbackDescription: "The application could not be rejected." }}
      onSuccess={() => router.refresh()}
    />
  );
}
