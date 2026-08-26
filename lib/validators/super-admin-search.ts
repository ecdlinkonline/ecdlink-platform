import { z } from "zod";

export const superAdminSearchQuerySchema = z.object({
  q: z.string().trim().min(2, "Enter at least 2 characters.").max(100, "Search queries must be 100 characters or fewer.")
});
