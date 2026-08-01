"use client";

import { useRouter } from "next/navigation";
import { MessageSquareWarning } from "lucide-react";
import { WorkflowActionDialog, type WorkflowActionResult } from "@/components/workflows/workflow-action-dialog";

type ClarificationValues = {
  message: string;
};

type RequestClarificationDialogProps = {
  applicationId: string;
  applicationNumber: string;
};

export function RequestClarificationDialog({ applicationId, applicationNumber }: RequestClarificationDialogProps) {
  const router = useRouter();

  return (
    <WorkflowActionDialog<ClarificationValues>
      title="Request clarification"
      description={`Explain what is required from the applicant for ${applicationNumber}.`}
      trigger={{
        label: "Request Clarification",
        variant: "secondary",
        icon: <MessageSquareWarning className="h-4 w-4" />,
      }}
      confirmationButton={{
        label: "Send Request",
        loadingLabel: "Sending…",
        tone: "primary",
      }}
      cancelLabel="Cancel"
      fields={[
        {
          name: "message",
          type: "textarea",
          label: "Clarification message",
          placeholder: "Describe the missing information or changes required.",
          rows: 6,
          required: true,
        },
      ]}
      initialValues={{ message: "" }}
      action={async (values): Promise<WorkflowActionResult> => {
        const response = await fetch(`/api/funding/applications/${applicationId}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Clarification Requested",
            notes: values.message.trim(),
          }),
        });
        const result = await response.json() as { ok?: boolean; error?: string };
        if (!response.ok || !result.ok) {
          return { ok: false, error: result.error ?? "The clarification request could not be sent." };
        }
        return { ok: true };
      }}
      successToast={{
        title: "Clarification requested",
        description: `${applicationNumber} was returned for clarification.`,
      }}
      errorToast={{
        title: "Clarification request failed",
        fallbackDescription: "The clarification request could not be sent.",
      }}
      onSuccess={() => router.refresh()}
    />
  );
}
