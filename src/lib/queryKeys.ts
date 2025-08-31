export const queryKeys = {
  RECORDING_DETAILS: (id: number) => ["recordingDetails", id] as const,
  RECORDINGS: ["recordings"] as const,
};
