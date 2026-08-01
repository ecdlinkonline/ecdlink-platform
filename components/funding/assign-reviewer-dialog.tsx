"use client";

import { UserRoundPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { WorkflowActionDialog, type WorkflowActionResult } from "@/components/workflows/workflow-action-dialog";
import type { FundingReviewerOption } from "@/lib/funding/types";

type AssignReviewerValues = {
  reviewerUserId: string;
  internalNote: string;
};

type AssignReviewerDialogProps = {
  applicationId: string;
  applicationNumber: string;
  reviewers: FundingReviewerOption[];
};

export function AssignReviewerDialog({ applicationId, applicationNumber, reviewers }: AssignReviewerDialogProps) {
  const router = useRouter();

  return (
    <WorkflowActionDialog<AssignReviewerValues>
      title="Assign reviewer"
      description={`Select the reviewer responsible for ${applicationNumber}.`}
      trigger={{ label: "Assign Reviewer", variant: "secondary", icon: <UserRoundPlus className="h-4 w-4" /> }}
      confirmationButton={{ label: "Assign Reviewer", loadingLabel: "Assigning…", tone: "warning" }}
      fields={[
        { name: "reviewerUserId", type: "select", label: "Reviewer", placeholder: "Select a reviewer", options: reviewers, required: true },
        { name: "internalNote", type: "textarea", label: "Internal Note", rows: 4 },
      ]}
      initialValues={{ reviewerUserId: "", internalNote: "" }}
      action={async (values): Promise<WorkflowActionResult> => {
        const response = await fetch(`/api/funding/applications/${applicationId}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "assign_reviewer",
            reviewerUserId: values.reviewerUserId,
            notes: values.internalNote.trim() || undefined,
          }),
        });
        const result = await response.json() as { ok?: boolean; error?: string };
        return response.ok && result.ok
          ? { ok: true }
          : { ok: false, error: result.error ?? "The reviewer could not be assigned." };
      }}
      successToast={{ title: "Reviewer assigned", description: `A reviewer has been assigned to ${applicationNumber}.` }}
      errorToast={{ title: "Assignment failed", fallbackDescription: "The reviewer could not be assigned." }}
      onSuccess={() => router.refresh()}
    />
  );
}
