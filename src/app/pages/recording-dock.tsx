import { CircleStop, GripVertical } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import Button from "../../components/button/button";
import ElapsedTime from "../../features/elapsed-time/components/elapsed-time";
import { stopRecording } from "../../features/recording-controls/api/recording-state";
import { useRecordingStateStore } from "../../stores/recording-state.store";

const RecordingDock = () => {
  const isRecording = useRecordingStateStore(
    useShallow((state) => state.isRecording)
  );

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
        showFocus={false}
        variant="soft"
        onPress={() => {
          stopRecording();
        }}
      >
        <CircleStop className="animate-pulse" size={18} />
        {isRecording && <ElapsedTime />}
      </Button>
    </div>
  );
};

export default RecordingDock;
