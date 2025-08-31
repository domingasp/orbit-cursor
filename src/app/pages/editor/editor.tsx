import { useQuery } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { Orbit, TvMinimalPlay } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, Text } from "react-aria-components";
import { useShallow } from "zustand/react/shallow";

import {
  getRecordingDetails,
  recordingOpened,
} from "../../../api/recording-management";
import { Button } from "../../../components/base/button/button";
import { Modal } from "../../../components/base/modal/modal";
import { useToast } from "../../../components/base/toast/toast-provider";
import { ExportOptions } from "../../../features/export-options/components/export-options";
import { normalizePath } from "../../../features/export-options/utils/file";
import { PreviewPlayer } from "../../../features/preview-player/components/preview-player";
import { RecordingName } from "../../../features/recording-name/components/recording-name";
import { Titlebar } from "../../../features/titlebar/components/titlebar";
import { Toolbar } from "../../../features/toolbar/components/toolbar";
import { usePlaybackStore } from "../../../stores/editor/playback.store";
import { useRecordingStateStore } from "../../../stores/recording-state.store";
import { Events } from "../../../types/events";

import { RecordingListModal } from "./recording-list-modal";

export const Editor = () => {
  // top level background color
  document.documentElement.classList.add(
    "bg-content",
    "overflow-hidden",
    "w-dvw",
    "h-dvh"
  );

  const toasts = useToast();

  const [currentRecordingId, setCurrenRecordingId] = useState<number | null>(
    null
  );
  const { data: recordingDetails } = useQuery({
    enabled: currentRecordingId !== null,
    queryFn: () => getRecordingDetails(currentRecordingId as number),
    queryKey: ["recordingDetails", currentRecordingId],
  });

  const [pause, seek] = usePlaybackStore(
    useShallow((state) => [state.pause, state.seek])
  );

  const setIsFinalizing = useRecordingStateStore(
    useShallow((state) => state.setIsFinalizing)
  );

  const [isRecordingsOpen, setIsRecordingsOpen] = useState(false);
  const [isExportOptionsOpen, setIsExportOptionsOpen] = useState(false);

  const resetPreview = (closeModals = true) => {
    pause();
    seek(0);
    if (closeModals) {
      setIsExportOptionsOpen(false);
      setIsRecordingsOpen(false);
    }
    toasts.closeAll();
  };

  useEffect(() => {
    const unlisten = listen(Events.RecordingComplete, (data) => {
      setCurrenRecordingId(data.payload as number);

      // Recording dock clean up
      setIsFinalizing(false);
    });

    return () => {
      void unlisten.then((f) => {
        f();
      });
    };
  }, []);

  useEffect(() => {
    const unlisten = listen(Events.ClosedEditor, () => {
      resetPreview();
    });

    return () => {
      void unlisten.then((f) => {
        f();
      });
    };
  }, []);

  useEffect(() => {
    resetPreview(false);
    if (currentRecordingId !== null) {
      recordingOpened(currentRecordingId);
    }
  }, [currentRecordingId]);

  return (
    <div className="text-content-fg bg-transparent relative h-dvh select-none">
      <Titlebar
        onPressRecordings={() => {
          setIsRecordingsOpen(true);
        }}
      >
        {!recordingDetails && "Orbit Cursor"}
        {recordingDetails && (
          <RecordingName
            name={recordingDetails.name}
            recordingId={recordingDetails.id}
          />
        )}
      </Titlebar>

      {!recordingDetails && (
        <div className="text-content-fg font-bold text-2xl flex items-center justify-center absolute inset-3 gap-8">
          <Orbit
            className="animate-[spin_80s_linear_infinite_reverse] text-muted"
            size={128}
          />

          <div className="flex flex-col items-center gap-2">
            <Text>No Recording Open</Text>
            <Button
              className="w-full justify-center"
              onPress={() => {
                setIsRecordingsOpen(true);
              }}
              shiny
            >
              <TvMinimalPlay size={16} />
              Recordings
            </Button>
          </div>
        </div>
      )}

      {recordingDetails && (
        <>
          <PreviewPlayer
            cameraPath={recordingDetails.camera}
            microphonePath={recordingDetails.microphone}
            screenPath={recordingDetails.screen}
            systemAudioPath={recordingDetails.systemAudio}
          />

          <Toolbar
            hotkeysEnabled={!isExportOptionsOpen}
            openExportOptions={() => {
              setIsExportOptionsOpen(true);
            }}
          />

          <Modal
            className="max-w-lg"
            isOpen={isExportOptionsOpen}
            onOpenChange={setIsExportOptionsOpen}
          >
            <Dialog className="outline-none">
              <ExportOptions
                defaultFilename={recordingDetails.name}
                hasCamera={recordingDetails.camera !== null}
                onCancel={() => {
                  setIsExportOptionsOpen(false);
                }}
                recordingDirectory={normalizePath(recordingDetails.screen)
                  .split("/")
                  .slice(0, -1)
                  .join("/")}
              />
            </Dialog>
          </Modal>
        </>
      )}

      <RecordingListModal
        currentRecordingId={currentRecordingId}
        isRecordingsOpen={isRecordingsOpen}
        setCurrentRecordingId={setCurrenRecordingId}
        setIsRecordingsOpen={setIsRecordingsOpen}
      />
    </div>
  );
};
