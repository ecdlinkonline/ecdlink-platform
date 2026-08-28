import { buildGrantAwardSubmission, type GrantAwardFormValues } from "./award-form";

type AwardFlowResult = { ok: true; data?: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string> };
type AwardFlowPhase = "uploading" | "creating";
type ErrorBody = { error?: string; details?: { fieldErrors?: Record<string, string[]> } };

async function responseBody(response: Response) {
  return response.json().catch(() => null) as Promise<({ data?: unknown } & ErrorBody) | null>;
}

export async function executeGrantAwardCreation(input: {
  values: GrantAwardFormValues;
  agreementFile: File | null;
  fetcher?: typeof fetch;
  onPhase?: (phase: AwardFlowPhase) => void;
}): Promise<AwardFlowResult> {
  const fetcher = input.fetcher ?? fetch;
  let stagedFileAssetId: string | undefined;
  let awardRequestStarted = false;

  try {
    if (input.agreementFile) {
      input.onPhase?.("uploading");
      const formData = new FormData();
      formData.set("file", input.agreementFile);
      const uploadResponse = await fetcher("/api/grant-awards/agreements/stage", { method: "POST", body: formData });
      const uploadBody = await responseBody(uploadResponse);
      stagedFileAssetId = typeof uploadBody?.data === "object" && uploadBody.data && "id" in uploadBody.data
        ? String(uploadBody.data.id)
        : undefined;
      if (!uploadResponse.ok || !stagedFileAssetId) {
        return { ok: false, error: uploadBody?.error ?? "The signed agreement could not be uploaded." };
      }
    }

    input.onPhase?.("creating");
    awardRequestStarted = true;
    const awardResponse = await fetcher("/api/grant-awards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGrantAwardSubmission(input.values, stagedFileAssetId)),
    });
    const awardBody = await responseBody(awardResponse);
    if (!awardResponse.ok) {
      return {
        ok: false,
        error: awardBody?.error ?? "The award could not be created.",
        fieldErrors: Object.fromEntries(Object.entries(awardBody?.details?.fieldErrors ?? {}).map(([name, messages]) => [name, messages[0] ?? "Invalid value."])),
      };
    }
    return { ok: true, data: awardBody?.data };
  } catch {
    // Once the award request starts, its server handler owns staged-file rollback.
    if (stagedFileAssetId && !awardRequestStarted) {
      await fetcher(`/api/grant-awards/agreements/stage/${stagedFileAssetId}`, { method: "DELETE" }).catch(() => undefined);
    }
    return { ok: false, error: "The award could not be created." };
  }
}
