import { listen } from "@tauri-apps/api/event";
import { CircleSlash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "react-aria-components";
import { useShallow } from "zustand/react/shallow";

import Modal from "../../components/modal/modal";
import ExportOptions from "../../features/export-options/components/export-options";
import PreviewPlayer from "../../features/preview-player/components/preview-player";
import Toolbar from "../../features/toolbar/components/toolbar";
import { usePlaybackStore } from "../../stores/editor/playback.store";
import { Events } from "../../types/events";

type RecordingManifest = {
  directory: string;
  files: {
    camera: string | null;
    metadata: string;
    microphone: string | null;
    mouseEvents: string;
    screen: string;
    systemAudio: string | null;
  };
};

const Editor = () => {
  // top level background color
  document.documentElement.classList.add(
    "bg-content",
    "overflow-hidden",
    "w-dvw",
    "h-dvh"
  );

  const [recordingManifest, setRecordingManifest] = useState<
    RecordingManifest | undefined
  >();

  const [pause, seek] = usePlaybackStore(
    useShallow((state) => [state.pause, state.seek])
  );

  const [isExportOptionsOpen, setIsExportOptionsOpen] = useState(false);
  const name = recordingManifest?.directory.split("/").at(-1) ?? "";

  useEffect(() => {
    const unlisten = listen(Events.RecordingComplete, (data) => {
      setRecordingManifest(data.payload as RecordingManifest);
    });

    return () => {
      void unlisten.then((f) => {
        f();
      });
    };
  }, []);

  const createPath = (file: string | null): string | undefined => {
    if (!recordingManifest || !file) return undefined;
    return recordingManifest.directory + "/" + file;
  };

  useEffect(() => {
    const unlisten = listen(Events.ClosedEditor, () => {
      pause();
      seek(0);
      setIsExportOptionsOpen(false);
    });

    return () => {
      void unlisten.then((f) => {
        f();
      });
    };
  }, []);

  return (
    <div className="text-content-fg bg-transparent relative h-dvh">
      <div
        className="flex flex-row justify-center p-1 text-sm"
        data-tauri-drag-region
      >
        {!recordingManifest && "No Recording Created"}
        {recordingManifest && name}
      </div>

      {!recordingManifest && (
        <div className="text-content-fg font-bold text-2xl flex items-center justify-center absolute -z-1 inset-0">
          <CircleSlash2 size={64} />
        </div>
      )}

      {recordingManifest && (
        <>
          <PreviewPlayer
            cameraPath={createPath(recordingManifest.files.camera)}
            microphonePath={createPath(recordingManifest.files.microphone)}
            screenPath={createPath(recordingManifest.files.screen) ?? ""}
            systemAudioPath={createPath(recordingManifest.files.systemAudio)}
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
                fileName={name}
                onCancel={() => {
                  setIsExportOptionsOpen(false);
                }}
              />
            </Dialog>
          </Modal>
        </>
      )}
    </div>
  );
};

export default Editor;
