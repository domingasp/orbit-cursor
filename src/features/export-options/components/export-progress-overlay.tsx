import { listen } from "@tauri-apps/api/event";
import { Camera, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import Button from "../../../components/button/button";
import CircularProgressBar from "../../../components/circular-progress-bar/circular-progress-bar";
import Overlay from "../../../components/overlay/overlay";
import { useToast } from "../../../components/toast/toast-provider";
import { usePlaybackStore } from "../../../stores/editor/playback.store";
import { Events } from "../../../types/events";
import { openPathInFileBrowser } from "../api/export";

type ExportProgressOverlayProps = {
  isOpen: boolean;
  requiresCameraState: boolean;
  onComplete?: () => void;
};
const ExportProgressOverlay = ({
  isOpen,
  onComplete,
  requiresCameraState,
}: ExportProgressOverlayProps) => {
  const toast = useToast();
  const duration = usePlaybackStore(
    useShallow((state) => state.shortestDuration)
  );

  const [progress, setProgress] = useState(0);
  const showingCameraState = progress === 0 && requiresCameraState;

  useEffect(() => {
    const unlistenProgress = listen(Events.ExportProgress, (data) => {
      const millisecondsProcessed = data.payload as number;
      if (duration) {
        setProgress((millisecondsProcessed / 1000 / duration) * 100);
      }
    });

    const unlistenExportComplete = listen(Events.ExportComplete, (data) => {
      const toastKey = toast.add({
        description: "Click the folder to open export location.",
        leftSection: (
          <Button
            aria-label="Open export folder"
            className="p-2"
            size="sm"
            variant="ghost"
            onPress={() => {
              openPathInFileBrowser(data.payload as string);
              toast.close(toastKey);
            }}
            shiny
          >
            <FolderOpen className="animate-pulse" size={20} />
          </Button>
        ),
        title: "Export Completed",
      });

      onComplete?.();
    });

    return () => {
      void unlistenProgress.then((f) => {
        f();
      });
      void unlistenExportComplete.then((f) => {
        f();
      });
    };
  }, []);

  useEffect(() => {
    setProgress(0);
  }, [isOpen]);

  return (
    <Overlay blur="lg" isOpen={isOpen}>
      <div className="flex flex-col items-center justify-center gap-2">
        <CircularProgressBar
          aria-label="Export progress"
          indeterminate={showingCameraState}
          value={progress}
          renderLabel={
            showingCameraState
              ? () => (
                  <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                    <Camera size={28} />
                  </div>
                )
              : undefined
          }
        />
        <span className="text-muted font-thin">
          {showingCameraState
            ? "Exporting camera..."
            : "Exporting recording..."}
        </span>
      </div>
    </Overlay>
  );
};

export default ExportProgressOverlay;
