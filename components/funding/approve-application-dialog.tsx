"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { WorkflowActionDialog, type WorkflowActionResult } from "@/components/workflows/workflow-action-dialog";

type ApproveApplicationValues = {
  approvedAmount: number | string;
  approvalNotes: string;
};

export function ApproveApplicationDialog({ applicationId, applicationNumber }: { applicationId: string; applicationNumber: string }) {
  const router = useRouter();

  return (
    <WorkflowActionDialog<ApproveApplicationValues>
      title="Approve application"
      description={`Confirm the approved amount and record any approval notes for ${applicationNumber}.`}
      trigger={{ label: "Approve", icon: <CircleCheck className="h-4 w-4" /> }}
      confirmationButton={{ label: "Approve Application", loadingLabel: "Approving…", tone: "primary" }}
      fields={[
        { name: "approvedAmount", type: "number", label: "Approved Amount", required: true, min: 0.01, step: 0.01 },
        { name: "approvalNotes", type: "textarea", label: "Approval Notes", rows: 4 },
      ]}
      initialValues={{ approvedAmount: "", approvalNotes: "" }}
      action={async (values): Promise<WorkflowActionResult> => {
        const response = await fetch(`/api/funding/applications/${applicationId}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Approved",
            approvedAmount: values.approvedAmount,
            notes: values.approvalNotes.trim() || undefined,
          }),
        });
        const result = await response.json() as { ok?: boolean; error?: string };
        return response.ok && result.ok
          ? { ok: true }
          : { ok: false, error: result.error ?? "The application could not be approved." };
      }}
      successToast={{ title: "Application approved", description: `${applicationNumber} has been approved.` }}
      errorToast={{ title: "Approval failed", fallbackDescription: "The application could not be approved." }}
      onSuccess={() => router.refresh()}
    />
  );
}
