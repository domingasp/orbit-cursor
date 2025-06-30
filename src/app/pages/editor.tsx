import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

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
  document.documentElement.classList.add("bg-content");

  const [recordingManifest, setRecordingManifest] = useState<
    RecordingManifest | undefined
  >();

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

  if (!recordingManifest) {
    return <div>No recording manifest...</div>;
  }

  return (
    <div className="text-content-fg bg-transparent">
      <div
        className="flex flex-row justify-center p-1 font-semibold"
        data-tauri-drag-region
      >
        {recordingManifest.directory.split("/").at(-1) ?? ""}
      </div>

      <div>Editor goes here...</div>
    </div>
  );
};

export default Editor;
