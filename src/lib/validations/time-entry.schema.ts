import { z } from "zod";

export const createTimeEntrySchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  date: z.coerce.date(),
  hours: z.coerce.number().positive("Hours must be positive").max(24, "Hours cannot exceed 24"),
  description: z.string().optional(),
  isBillable: z.boolean().default(true),
});

export const updateTimeEntrySchema = z.object({
  projectId: z.string().optional(),
  date: z.coerce.date().optional(),
  hours: z.coerce.number().positive().max(24).optional(),
  description: z.string().optional(),
  isBillable: z.boolean().optional(),
});

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;
