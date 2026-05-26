import { z } from "zod";

export const ingestSchema = z.object({
  played_at: z.number().int().nonnegative(),
  user: z.string(),
  nd_track_id: z.string().min(1),
});

export type IngestBody = z.infer<typeof ingestSchema>;
