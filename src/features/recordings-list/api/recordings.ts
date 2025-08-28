import { invoke } from "@tauri-apps/api/core";
import z from "zod";

import { Commands } from "../../../types/api";

// TODO remove and generalise - separate ticket to refactor enum use
const RecordingTypeSchema = z.enum(["screen", "region", "window"]);

const RecordingMetadataSchema = z.object({
  createdAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid date string",
    })
    .transform((val) => new Date(val)),
  id: z.number(),
  lengthMs: z.number().nullable().optional(),
  name: z.string(),
  sizeBytes: z.number().nullable().optional(),
  type: RecordingTypeSchema.nullable().optional(),
});

const RecordingMetadataArraySchema = z.array(RecordingMetadataSchema);

export type RecordingMetadata = z.infer<typeof RecordingMetadataSchema>;

export const listRecordings = async (): Promise<RecordingMetadata[]> => {
  const data = await invoke(Commands.ListRecordings);
  return RecordingMetadataArraySchema.parse(data);
};
