import { z } from "zod";

const plainText = (maximum: number) => z.string().trim().min(1).max(maximum);
export const fundingReviewerNoteSchema = z.object({ body: plainText(5000) });
export const fundingManualCommunicationSchema = z.object({
  type: z.literal("MANUAL"),
  title: plainText(200),
  body: plainText(10000),
});
