import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../../../components/base/toast/toast-provider";
import { hardDeleteRecordings } from "../../../../features/recording-list-preview/api/recording";
import { RecordingMetadata } from "../../../../features/recordings-list/api/recordings";
import { pluralize } from "../../../../lib/format";
import { queryKeys } from "../../../../lib/queryKeys";

type UseHardDeleteRecordingsProps = {
  selected: string[];
  setSelected: (ids: string[]) => void;
};

export const useHardDeleteRecordings = ({
  selected,
  setSelected,
}: UseHardDeleteRecordingsProps) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (ids: number[]) => hardDeleteRecordings(ids),

    onSuccess: (_, ids: number[]) => {
      const key = [queryKeys.RECORDINGS];
      queryClient.setQueryData<RecordingMetadata[] | undefined>(key, (old) =>
        old ? old.filter((item) => !ids.includes(item.id)) : old
      );

      toast.add(
        {
          hasClose: false,
          leftSection: (
            <span className="px-1 font-bold text-error text-lg">
              {selected.length.toString()}
            </span>
          ),
          title: `${pluralize("Recording", selected.length)} deleted`,
        },
        { timeout: 3000 }
      );

      setSelected([]);
    },
  });
};
