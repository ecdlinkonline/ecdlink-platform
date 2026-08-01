"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareWarning } from "lucide-react";
import { useToast } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RequestClarificationDialogProps = {
  applicationId: string;
  applicationNumber: string;
};

export function RequestClarificationDialog({ applicationId, applicationNumber }: RequestClarificationDialogProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  function closeDialog() {
    if (isSending) return;
    setOpen(false);
    setMessage("");
    setError(null);
  }

  async function sendRequest() {
    const reason = message.trim();
    if (!reason) {
      setError("A clarification message is required.");
      return;
    }

    setError(null);
    setIsSending(true);

    try {
      const response = await fetch(`/api/funding/applications/${applicationId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Clarification Requested", notes: reason }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "The clarification request could not be sent.");
      }

      setOpen(false);
      setMessage("");
      pushToast({
        title: "Clarification requested",
        description: `${applicationNumber} was returned for clarification.`,
      });
      router.refresh();
    } catch (requestError) {
      const description = requestError instanceof Error ? requestError.message : "The clarification request could not be sent.";
      setError(description);
      pushToast({ title: "Clarification request failed", description });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <MessageSquareWarning className="h-4 w-4" />
        Request Clarification
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4" role="presentation">
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="w-full max-w-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <CardHeader>
              <CardTitle id={titleId} className="dark:text-white">Request clarification</CardTitle>
              <CardDescription id={descriptionId} className="dark:text-slate-400">
                Explain what is required from the applicant for {applicationNumber}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-brand-ink dark:text-white">Clarification message</span>
                <textarea
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    if (error) setError(null);
                  }}
                  rows={6}
                  required
                  disabled={isSending}
                  className="mt-2 w-full resize-y rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-navy dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="Describe the missing information or changes required."
                />
              </label>
              {error ? <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p> : null}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" disabled={isSending} onClick={closeDialog}>Cancel</Button>
                <Button type="button" disabled={isSending} onClick={() => void sendRequest()}>
                  {isSending ? "Sending…" : "Send Request"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
