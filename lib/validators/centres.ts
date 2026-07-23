import { z } from "zod";

export const centreUpdateSchema = z.object({
  centreName: z.string().min(2).optional(),
  principalName: z.string().min(2).optional(),
  contactPerson: z.string().min(2).optional(),
  phoneNumber: z.string().min(5).optional(),
  emailAddress: z.string().email().optional(),
  physicalAddress: z.string().min(4).optional(),
  npoNumber: z.string().optional(),
  dbeRegistrationStatus: z.string().optional(),
  area: z.string().optional(),
  region: z.string().optional(),
  numberOfChildren: z.coerce.number().int().nonnegative().optional(),
  numberOfStaff: z.coerce.number().int().nonnegative().optional()
});

export type CentreUpdateInput = z.infer<typeof centreUpdateSchema>;
