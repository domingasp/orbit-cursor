import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../../../components/base/toast/toast-provider";
import { restoreRecordings } from "../../../../features/recording-list-preview/api/recording";
import { RecordingMetadata } from "../../../../features/recordings-list/api/recordings";
import { pluralize } from "../../../../lib/format";
import { queryKeys } from "../../../../lib/queryKeys";

type UseRestoreRecordingsProps = {
  selected: string[];
  setSelected: (ids: string[]) => void;
};

export const useRestoreRecordings = ({
  selected,
  setSelected,
}: UseRestoreRecordingsProps) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (ids: number[]) => restoreRecordings(ids),

    onSuccess: (_, ids: number[]) => {
      const key = [queryKeys.RECORDINGS];
      queryClient.setQueryData<RecordingMetadata[] | undefined>(key, (old) =>
        old
          ? old.map((item) =>
              ids.includes(item.id) ? { ...item, deletedAt: null } : item
            )
          : old
      );

      toast.add(
        {
          hasClose: false,
          leftSection: (
            <span className="px-1 font-bold text-info text-lg">
              {selected.length.toString()}
            </span>
          ),
          title: `${pluralize("Recording", selected.length)} restored`,
        },
        { timeout: 3000 }
      );

      setSelected([]);
    },
  });
};
