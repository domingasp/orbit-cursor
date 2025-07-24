import { listen } from "@tauri-apps/api/event";
import { CircleStop, GripVertical, LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "../../components/button/button";
import { ElapsedTime } from "../../features/elapsed-time/components/elapsed-time";
import { stopRecording } from "../../features/recording-controls/api/recording-state";
import { useRecordingStateStore } from "../../stores/recording-state.store";
import { Events } from "../../types/events";

export const RecordingDock = () => {
  const [isRecording, setIsRecording] = useRecordingStateStore(
    useShallow((state) => [state.isRecording, state.setIsRecording])
  );

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

      <Button
        className="px-2 select-none my-1 mr-1"
        color="neutral"
        isDisabled={!isRecording}
        showFocus={false}
        variant="soft"
        onPress={() => {
          setIsRecording(false);
          stopRecording();
        }}
      >
        {isRecording ? (
          <CircleStop className="animate-pulse" size={18} />
        ) : (
          <LoaderCircle className="animate-spin" size={18} />
        )}
        <ElapsedTime isRecording={isRecording} />
      </Button>
    </div>
  );
};
