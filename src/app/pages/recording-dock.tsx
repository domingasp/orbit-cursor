import { listen } from "@tauri-apps/api/event";
import {
  CirclePause,
  CirclePlay,
  CircleStop,
  GripVertical,
  LoaderCircle,
} from "lucide-react";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "../../components/button/button";
import { ToggleButton } from "../../components/button/toggle-button";
import { ElapsedTime } from "../../features/elapsed-time/components/elapsed-time";
import { stopRecording } from "../../features/recording-controls/api/recording-state";
import { cn } from "../../lib/styling";
import { useRecordingStateStore } from "../../stores/recording-state.store";
import { Events } from "../../types/events";

const iconSize = 18;

export const RecordingDock = () => {
  const [isRecording, setIsRecording, isPaused, setIsPaused] =
    useRecordingStateStore(
      useShallow((state) => [
        state.isRecording,
        state.setIsRecording,
        state.isPaused,
        state.setIsPaused,
      ])
    );

  const handlePause = (isSelected: boolean) => {
    setIsPaused(isSelected);
  };

  useEffect(() => {
    const unlisten = listen(Events.RecordingStarted, () => {
      setIsRecording(true);
    });

    return () => {
      void unlisten.then((f) => {
        f();
      });
    };
  }, []);

  return (
    <div className="flex flex-row w-screen h-screen justify-center">
      <div
        className="w-full h-full text-muted cursor-grab flex justify-center items-center"
        data-tauri-drag-region
      >
        <GripVertical className="ml-[2px] pointer-events-none" size={20} />
      </div>

      <ToggleButton
        className="px-2"
        isDisabled={!isRecording}
        isSelected={isPaused}
        off={<CirclePause size={iconSize} />}
        onChange={handlePause}
        on={
          <CirclePlay className="text-warning animate-pulse" size={iconSize} />
        }
      />

      <Button
        className="px-2 select-none my-1 mr-1"
        color="neutral"
        isDisabled={!isRecording}
        showFocus={false}
        variant="soft"
        onPress={() => {
          setIsPaused(false);
          setIsRecording(false);
          stopRecording();
        }}
      >
        {isRecording ? (
          <CircleStop
            size={iconSize}
            className={cn(
              "transition-colors",
              !isPaused && "animate-pulse text-error",
              isPaused && "text-muted"
            )}
          />
        ) : (
          <LoaderCircle className="animate-spin" size={iconSize} />
        )}
        <ElapsedTime isPaused={isPaused} isRecording={isRecording} />
      </Button>
    </div>
  );
};
