import { listen } from "@tauri-apps/api/event";
import { CircleSlash2 } from "lucide-react";
import { useEffect, useState } from "react";

import PreviewPlayer from "../../features/preview-player/components/preview-player";
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

  const [currentTime, setCurrentTime] = useState(0);

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

  return (
    <div className="text-content-fg bg-transparent relative h-dvh">
      <div
        className="flex flex-row justify-center p-1 text-sm"
        data-tauri-drag-region
      >
        {!recordingManifest && "No Recording Created"}
        {recordingManifest && recordingManifest.directory.split("/").at(-1)}
      </div>

      {!recordingManifest && (
        <div className="text-content-fg font-bold text-2xl flex items-center justify-center absolute -z-1 inset-0">
          <CircleSlash2 size={64} />
        </div>
      )}

      {recordingManifest && (
        <PreviewPlayer
          cameraPath={createPath(recordingManifest.files.camera)}
          currentTime={currentTime}
          microphonePath={createPath(recordingManifest.files.microphone)}
          screenPath={createPath(recordingManifest.files.screen) ?? ""}
          setCurrentTime={setCurrentTime}
          systemAudioPath={createPath(recordingManifest.files.systemAudio)}
        />
      )}
    </div>
  );
};

export default Editor;
