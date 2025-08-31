import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../../../components/base/toast/toast-provider";
import { softDeleteRecordings } from "../../../../features/recording-list-preview/api/recording";
import { RecordingMetadata } from "../../../../features/recordings-list/api/recordings";
import { pluralize } from "../../../../lib/format";
import { queryKeys } from "../../../../lib/queryKeys";

type UseSoftDeleteRecordingsProps = {
  selected: string[];
  setCurrentRecordingId: (id: number | null) => void;
  setSelected: (ids: string[]) => void;
};

export const useSoftDeleteRecordings = ({
  selected,
  setCurrentRecordingId,
  setSelected,
}: UseSoftDeleteRecordingsProps) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (ids: number[]) => softDeleteRecordings(ids),

    onSuccess: (deletedAt, ids: number[]) => {
      const key = [queryKeys.RECORDINGS];
      queryClient.setQueryData<RecordingMetadata[] | undefined>(key, (old) =>
        old
          ? old.map((item) =>
              ids.includes(item.id) ? { ...item, deletedAt } : item
            )
          : old
      );

      toast.add(
        {
          hasClose: false,
          leftSection: (
            <span className="px-1 font-bold text-warning text-lg">
              {selected.length.toString()}
            </span>
          ),
          title: `${pluralize(
            "Recording",
            selected.length
          )} moved to Recently Deleted`,
        },
        { timeout: 3000 }
      );

      setCurrentRecordingId(null);
      setSelected([]);
    },
  });
};
