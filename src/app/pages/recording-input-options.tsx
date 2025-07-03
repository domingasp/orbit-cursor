import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { isRecordingInputOptionsOpen } from "../../api/windows";
import InputAudioSelect from "../../features/audio-inputs/components/input-audio-select";
import CameraSelect from "../../features/camera-select/components/camera-select";
import { clearInteractionAttributes } from "../../lib/styling";
import {
  AppWindow,
  useWindowReopenStore,
} from "../../stores/window-open-state.store";
import { Events } from "../../types/events";

const RecordingInputOptions = () => {
  const [addWindow, setWindowOpenState] = useWindowReopenStore(
    useShallow((state) => [state.addWindow, state.setWindowOpenState])
  );

  useEffect(() => {
    const addWindowToStore = async () => {
      addWindow(
        AppWindow.RecordingInputOptions,
        await isRecordingInputOptionsOpen()
      );
    };
    void addWindowToStore();

    const unlisten = listen(Events.RecordingInputOptionsOpened, () => {
      clearInteractionAttributes();
      setWindowOpenState(AppWindow.RecordingInputOptions, true);
    });
    const unlistenClose = listen(Events.ClosedRecordingInputOptions, () => {
      setWindowOpenState(AppWindow.RecordingInputOptions, false);
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
      <InputAudioSelect />
    </div>
  );
};

export default RecordingInputOptions;
