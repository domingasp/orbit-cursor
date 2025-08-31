import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { isRecordingInputOptionsOpen } from "../../api/windows";
import { MicrophoneSelect } from "../../features/audio-inputs/components/microphone-select";
import { CameraSelect } from "../../features/camera-select/components/camera-select";
import { clearInteractionAttributes } from "../../lib/styling";
import {
  appWindow,
  useWindowReopenStore,
} from "../../stores/window-open-state.store";
import { events } from "../../types/events";

export const RecordingInputOptions = () => {
  const [addWindow, setWindowOpenState] = useWindowReopenStore(
    useShallow((state) => [state.addWindow, state.setWindowOpenState])
  );

  useEffect(() => {
    const addWindowToStore = async () => {
      addWindow(
        appWindow.RECORDING_INPUT_OPTIONS,
        await isRecordingInputOptionsOpen()
      );
    };
    void addWindowToStore();

    const unlisten = listen(events.RECORDING_INPUT_OPTIONS_OPENED, () => {
      clearInteractionAttributes();
      setWindowOpenState(appWindow.RECORDING_INPUT_OPTIONS, true);
    });
    const unlistenClose = listen(events.CLOSED_RECORDING_INPUT_OPTIONS, () => {
      setWindowOpenState(appWindow.RECORDING_INPUT_OPTIONS, false);
    });

    return () => {
      void unlisten.then((f) => {
        f();
      });
      void unlistenClose.then((f) => {
        f();
      });
    };
  }, []);

  return (
    <div className="flex flex-col gap-2 p-4">
      <CameraSelect />
      <MicrophoneSelect />
    </div>
  );
};
