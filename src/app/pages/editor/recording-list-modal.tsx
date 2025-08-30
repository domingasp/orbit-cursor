import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Dialog } from "react-aria-components";
import { useShallow } from "zustand/react/shallow";

import { Modal } from "../../../components/base/modal/modal";
import { RecordingListPreview } from "../../../features/recording-list-preview/components/recording-list-preview";
import { listRecordings } from "../../../features/recordings-list/api/recordings";
import { RecordingsList } from "../../../features/recordings-list/components/recordings-list";
import { queryKeys } from "../../../lib/queryKeys";
import { usePlaybackStore } from "../../../stores/editor/playback.store";

import { useHardDeleteRecordings } from "./hooks/use-hard-delete-recordings";
import { useRestoreRecordings } from "./hooks/use-restore-recordings";
import { useSoftDeleteRecordings } from "./hooks/use-soft-delete-recordings";

type RecordingListModalProps = {
  currentRecordingId: number | null;
  isRecordingsOpen: boolean;
  setCurrentRecordingId: (id: number | null) => void;
  setIsRecordingsOpen: (isOpen: boolean) => void;
};

export const RecordingListModal = ({
  currentRecordingId,
  isRecordingsOpen,
  setCurrentRecordingId,
  setIsRecordingsOpen,
}: RecordingListModalProps) => {
  const pause = usePlaybackStore(useShallow((state) => state.pause));

  const [selected, setSelected] = useState<string[]>([]);
  const [recentlyDeletedVisible, setRecentlyDeletedVisible] = useState(false);

  const { data: recordings, refetch } = useQuery({
    queryFn: listRecordings,
    queryKey: [queryKeys.RECORDINGS],
  });

  const { mutate: softDeleteMutate } = useSoftDeleteRecordings({
    selected,
    setCurrentRecordingId,
    setSelected,
  });

  const { mutate: hardDeleteMutate } = useHardDeleteRecordings({
    selected,
    setSelected,
  });

  const { mutate: restoreMutate } = useRestoreRecordings({
    selected,
    setSelected,
  });

  const handleClose = () => {
    setIsRecordingsOpen(false);
    setSelected([]);
  };

  useEffect(() => {
    setSelected([]);

    if (!isRecordingsOpen) {
      setRecentlyDeletedVisible(false);
    } else {
      pause();
      void refetch();
    }
  }, [recentlyDeletedVisible, isRecordingsOpen, refetch]);

  return (
    <Modal
      className="max-w-3xl h-[70vh] max-h-125 p-0"
      isOpen={isRecordingsOpen}
      onOpenChange={setIsRecordingsOpen}
      isDismissable
    >
      <Dialog
        aria-label="Recordings list"
        className="outline-none flex w-full h-full"
      >
        <div className="flex-5 border-r-1 border-content-fg/10 shadow-[0_0_20px] shadow-content-fg/5 z-1 max-w-85">
          <RecordingsList
            currentlyOpenId={currentRecordingId ?? undefined}
            onCancel={handleClose}
            recentlyDeletedVisible={recentlyDeletedVisible}
            recordings={recordings ?? []}
            selected={selected}
            setSelected={setSelected}
            onOpen={(recordingId) => {
              setCurrentRecordingId(recordingId);
              handleClose();
            }}
            onRestore={() => {
              restoreMutate(selected.map((x) => parseInt(x, 10)));
            }}
          />
        </div>

        <div className="flex-6 bg-content relative shrink-0">
          <RecordingListPreview
            recentlyDeletedVisible={recentlyDeletedVisible}
            setRecentlyDeletedVisible={setRecentlyDeletedVisible}
            onDelete={() => {
              softDeleteMutate(selected.map((x) => parseInt(x, 10)));
            }}
            onHardDelete={() => {
              hardDeleteMutate(selected.map((x) => parseInt(x, 10)));
            }}
            selected={
              recordings?.filter((x) => selected.includes(x.id.toString())) ??
              []
            }
          />
        </div>
      </Dialog>
    </Modal>
  );
};
