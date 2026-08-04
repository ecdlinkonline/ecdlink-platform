"use client";

import { useRef, useState } from "react";
import { Download, Eye, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { WorkflowActionDialog, type WorkflowActionResult } from "@/components/workflows/workflow-action-dialog";
import type { FundingReviewDocument } from "@/lib/funding/types";

const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
const maxBytes = 10_000_000;

type FundingDocumentActionsProps = {
  document: FundingReviewDocument;
  canManage: boolean;
};

type VerifyValues = { reviewerComment: string };
type ResubmissionValues = { rejectionReason: string; reviewerComment: string };

async function documentAction(documentId: string, body: Record<string, string>) {
  const response = await fetch(`/api/funding/documents/${documentId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as { ok?: boolean; error?: string };
  return response.ok && result.ok
    ? { ok: true } as const
    : { ok: false, error: result.error ?? "The document action could not be completed." } as const;
}

export function FundingDocumentActions({ document, canManage }: FundingDocumentActionsProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const hasFile = Boolean(document.fileId);
  const previewable = hasFile && Boolean(document.mimeType && allowedTypes.includes(document.mimeType));
  const canVerify = hasFile && !document.verifiedAt;

  if (!canManage) return <span className="text-xs text-slate-500">No actions available</span>;

  function selectFile(file: File | undefined) {
    if (!file) return setSelectedFile(null);
    if (!allowedTypes.includes(file.type)) {
      setSelectedFile(null);
      pushToast({ title: "Unsupported file", description: "Upload a PDF, JPEG or PNG document." });
      return;
    }
    if (!file.size || file.size > maxBytes) {
      setSelectedFile(null);
      pushToast({ title: "Invalid file size", description: "The file must be non-empty and no larger than 10 MB." });
      return;
    }
    setSelectedFile(file);
  }

  async function uploadFile() {
    if (!selectedFile || isUploading) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      const response = await fetch(`/api/funding/documents/${document.id}/upload`, { method: "POST", body: formData });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "The document could not be uploaded.");
      pushToast({ title: hasFile ? "Document replaced" : "Document uploaded", description: `${selectedFile.name} is ready for review.` });
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (error) {
      pushToast({ title: "Upload failed", description: error instanceof Error ? error.message : "The document could not be uploaded." });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="min-w-64 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
          disabled={isUploading}
          onChange={(event) => selectFile(event.target.files?.[0])}
          className="max-w-52 text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-brand-accent file:px-2 file:py-1 file:font-bold file:text-brand-navy"
        />
        <Button type="button" variant="secondary" className="min-h-9 px-3" disabled={!selectedFile || isUploading} onClick={() => void uploadFile()}>
          <Upload className="h-4 w-4" />
          {isUploading ? "Uploading…" : hasFile ? "Replace" : "Upload"}
        </Button>
      </div>
      {selectedFile ? <p className="text-xs text-slate-500">Selected: {selectedFile.name}</p> : null}
      {hasFile ? (
        <div className="flex flex-wrap gap-2">
          {previewable ? (
            <Button type="button" variant="ghost" className="min-h-9 px-3" onClick={() => window.open(`/api/funding/documents/${document.id}/file?preview=1`, "_blank", "noopener,noreferrer")}>
              <Eye className="h-4 w-4" /> Preview
            </Button>
          ) : null}
          <Button type="button" variant="ghost" className="min-h-9 px-3" onClick={() => { window.location.href = `/api/funding/documents/${document.id}/file?download=1`; }}>
            <Download className="h-4 w-4" /> Download
          </Button>
          {canVerify ? (
            <WorkflowActionDialog<VerifyValues>
              title="Verify supporting document"
              description={`Confirm that ${document.label} is valid evidence.`}
              trigger={{ label: "Verify", variant: "secondary", icon: <ShieldCheck className="h-4 w-4" /> }}
              confirmationButton={{ label: "Verify Document", loadingLabel: "Verifying…", tone: "primary" }}
              fields={[{ name: "reviewerComment", type: "textarea", label: "Reviewer Comment", rows: 4, maxLength: 2000 }]}
              initialValues={{ reviewerComment: "" }}
              action={(values): Promise<WorkflowActionResult> => documentAction(document.id, { action: "verify", reviewerComment: values.reviewerComment.trim() })}
              successToast={{ title: "Document verified", description: `${document.label} has been verified.` }}
              errorToast={{ title: "Verification failed", fallbackDescription: "The document could not be verified." }}
              onSuccess={() => router.refresh()}
            />
          ) : null}
          <WorkflowActionDialog<ResubmissionValues>
            title="Request document resubmission"
            description={`Explain why ${document.label} must be resubmitted.`}
            trigger={{ label: "Request Resubmission", variant: "secondary", icon: <RotateCcw className="h-4 w-4" /> }}
            confirmationButton={{ label: "Request Resubmission", loadingLabel: "Sending…", tone: "warning" }}
            fields={[
              { name: "rejectionReason", type: "textarea", label: "Rejection Reason", rows: 4, required: true, minLength: 3, maxLength: 2000 },
              { name: "reviewerComment", type: "textarea", label: "Reviewer Comment", rows: 3, maxLength: 2000 },
            ]}
            initialValues={{ rejectionReason: "", reviewerComment: "" }}
            action={(values): Promise<WorkflowActionResult> => documentAction(document.id, { action: "request_resubmission", rejectionReason: values.rejectionReason.trim(), reviewerComment: values.reviewerComment.trim() })}
            successToast={{ title: "Resubmission requested", description: `${document.label} was returned for resubmission.` }}
            errorToast={{ title: "Request failed", fallbackDescription: "The resubmission request could not be sent." }}
            onSuccess={() => router.refresh()}
          />
        </div>
      ) : null}
    </div>
  );
}
