import { invoke } from "@tauri-apps/api/core";
import z from "zod";

import { recordingType } from "../../../stores/recording-state.store";
import { commands } from "../../../types/api";

const RecordingMetadataSchema = z.object({
  createdAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid date string",
    })
    .transform((val) => new Date(val)),
  deletedAt: z
    .string()
    .nullable()
    .optional()
    .refine(
      (val) => val === null || val === undefined || !isNaN(Date.parse(val)),
      {
        message: "Invalid date string",
      }
    )
    .transform((val) => (val ? new Date(val) : null)),
  hasCamera: z.boolean(),
  hasMicrophone: z.boolean(),
  hasSystemAudio: z.boolean(),
  hasSystemCursor: z.boolean(),
  id: z.number(),
  lengthMs: z.number().nullable().optional(),
  name: z.string(),
  sizeBytes: z.number().nullable().optional(),
  type: z.enum(recordingType).nullable().optional(),
});

const RecordingMetadataArraySchema = z.array(RecordingMetadataSchema);

export type RecordingMetadata = z.infer<typeof RecordingMetadataSchema>;

export const listRecordings = async (): Promise<RecordingMetadata[]> => {
  const data = await invoke(commands.LIST_RECORDINGS);
  return RecordingMetadataArraySchema.parse(data);
};
