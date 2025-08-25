import { useQuery } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { CircleSlash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "react-aria-components";
import { useShallow } from "zustand/react/shallow";

import { getRecordingDetails } from "../../api/recording-management";
import { TextField } from "../../components/base/input-fields/text-field";
import { Modal } from "../../components/base/modal/modal";
import { useToast } from "../../components/base/toast/toast-provider";
import { ExportOptions } from "../../features/export-options/components/export-options";
import { normalizePath } from "../../features/export-options/utils/file";
import { PreviewPlayer } from "../../features/preview-player/components/preview-player";
import { Titlebar } from "../../features/titlebar/components/titlebar";
import { Toolbar } from "../../features/toolbar/components/toolbar";
import { usePlaybackStore } from "../../stores/editor/playback.store";
import { useRecordingStateStore } from "../../stores/recording-state.store";
import { Events } from "../../types/events";

export const Editor = () => {
  // top level background color
  document.documentElement.classList.add(
    "bg-content",
    "overflow-hidden",
    "w-dvw",
    "h-dvh"
  );

  const toasts = useToast();

  const [recordingId, setRecordingId] = useState<number | null>(null);
  const { data: recordingDetails } = useQuery({
    enabled: recordingId !== null,
    queryFn: () => getRecordingDetails(recordingId as number),
    queryKey: ["recordingDetails", recordingId],
  });

  const [pause, seek] = usePlaybackStore(
    useShallow((state) => [state.pause, state.seek])
  );

  const setIsFinalizing = useRecordingStateStore(
    useShallow((state) => state.setIsFinalizing)
  );

  const [isExportOptionsOpen, setIsExportOptionsOpen] = useState(false);
  const name =
    normalizePath(recordingDetails?.screen ?? "")
      .split("/")
      .at(-2) ?? "";

  useEffect(() => {
    const unlisten = listen(Events.RecordingComplete, (data) => {
      setRecordingId(data.payload as number);

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
      pause();
      seek(0);
      setIsExportOptionsOpen(false);
      toasts.closeAll();
    });

    return () => {
      void unlisten.then((f) => {
        f();
      });
    };
  }, []);

  return (
    <div className="text-content-fg bg-transparent relative h-dvh">
      <Titlebar>
        {!recordingDetails && "No Recording"}
        {recordingDetails && (
          <TextField
            defaultValue={name}
            size="sm"
            variant="line"
            centered
            compact
          />
        )}
      </Titlebar>

      {!recordingDetails && (
        <div className="text-content-fg font-bold text-2xl flex items-center justify-center absolute -z-1 inset-0">
          <CircleSlash2 size={64} />
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
                defaultFilename={name}
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
    </div>
  );
};
