import { useMutation, useQueryClient } from "@tanstack/react-query";

import { RecordingDetails } from "../../../api/recording-management";
import { queryKeys } from "../../../lib/queryKeys";
import { RecordingMetadata } from "../../recordings-list/api/recordings";
import { updateRecordingName } from "../api/recording-name";

export const useUpdateRecordingName = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, newName }: { id: number; newName: string }) =>
      updateRecordingName(id, newName),

    onError: (_, { id }, ctx: { prev?: RecordingDetails } | undefined) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["recordingDetails", id], ctx.prev);
      }
    },

    onMutate: ({ id, newName }: { id: number; newName: string }) => {
      const key = [queryKeys.RECORDING_DETAILS(id)];
      const prev = queryClient.getQueryData<RecordingDetails>(key);
      if (prev) {
        queryClient.setQueryData<RecordingDetails>(key, {
          ...prev,
          name: newName,
        });
      }

      const list = [queryKeys.RECORDINGS];
      const prevList = queryClient.getQueryData<RecordingMetadata[]>(list);
      if (prevList) {
        queryClient.setQueryData<RecordingMetadata[]>(list, (old) =>
          old
            ? old.map((item) =>
                item.id === id ? { ...item, name: newName } : item
              )
            : old
        );
      }

      return { prev };
    },

    onSuccess: (_, { id, newName }) => {
      const key = [queryKeys.RECORDING_DETAILS(id)];
      queryClient.setQueryData<RecordingDetails | undefined>(key, (old) =>
        old ? { ...old, name: newName } : old
      );
    },
  });
};
