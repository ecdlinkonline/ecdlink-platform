"use client";

import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { WorkflowActionDialog, type WorkflowActionResult } from "@/components/workflows/workflow-action-dialog";
import type { FundingReviewerNoteRecord } from "@/lib/funding/types";

const request = async (url: string, method: string, body?: unknown): Promise<WorkflowActionResult> => { const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); const result = await response.json(); return response.ok && result.ok ? { ok: true } : { ok: false, error: result.error ?? "The reviewer note action failed." }; };

function NoteDialog({ applicationId, note }: { applicationId: string; note?: FundingReviewerNoteRecord }) {
  const router = useRouter();
  return <WorkflowActionDialog<{ body: string }> title={note ? "Edit reviewer note" : "Add reviewer note"} description="Internal funding-review notes are visible only to authorized staff." trigger={{ label: note ? "Edit" : "Add note", variant: note ? "ghost" : "primary", icon: note ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" /> }} confirmationButton={{ label: note ? "Save note" : "Add note", loadingLabel: "Saving…" }} fields={[{ name: "body", type: "textarea", label: "Reviewer note", rows: 6, required: true, maxLength: 5000 }]} initialValues={{ body: note?.body ?? "" }} action={(values) => request(note ? `/api/funding/notes/${note.id}` : `/api/funding/applications/${applicationId}/notes`, note ? "PATCH" : "POST", { body: values.body.trim() })} successToast={{ title: note ? "Reviewer note updated" : "Reviewer note added" }} errorToast={{ title: "Reviewer note failed", fallbackDescription: "The reviewer note could not be saved." }} onSuccess={() => router.refresh()} />;
}

export function FundingReviewerNotes({ applicationId, notes }: { applicationId: string | null; notes: FundingReviewerNoteRecord[] }) {
  const router = useRouter();
  if (!applicationId) return <p className="rounded-lg border border-dashed border-brand-line p-8 text-center text-sm text-slate-500">Create an application before adding reviewer notes.</p>;
  return <div className="space-y-4"><NoteDialog applicationId={applicationId} />{notes.length ? notes.map((note) => <article key={note.id} className="rounded-lg border border-brand-line p-4 dark:border-slate-800"><div className="flex items-start justify-between gap-4"><div><p className="font-bold">{note.author}</p><p className="text-xs text-slate-500">{new Date(note.createdAt).toLocaleString()} {note.updatedAt !== note.createdAt ? "· Edited" : ""}</p></div><div className="flex gap-2">{note.canEdit ? <NoteDialog applicationId={applicationId} note={note} /> : null}{note.canDelete ? <WorkflowActionDialog<Record<string, never>> title="Delete reviewer note" description="The note will be hidden but retained for audit history." trigger={{ label: "Delete", variant: "ghost", icon: <Trash2 className="h-4 w-4" /> }} confirmationButton={{ label: "Delete note", loadingLabel: "Deleting…", tone: "danger" }} fields={[]} initialValues={{}} action={() => request(`/api/funding/notes/${note.id}`, "DELETE")} successToast={{ title: "Reviewer note deleted" }} errorToast={{ title: "Delete failed", fallbackDescription: "The reviewer note could not be deleted." }} onSuccess={() => router.refresh()} /> : null}</div></div><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{note.body}</p></article>) : <p className="rounded-lg border border-dashed border-brand-line p-8 text-center text-sm text-slate-500">No reviewer notes have been added.</p>}</div>;
}
