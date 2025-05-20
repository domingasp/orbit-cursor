import { listen } from "@tauri-apps/api/event";
import clsx from "clsx";
import { Lock } from "lucide-react";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import Overlay from "../../components/overlay/overlay";
import RecordingControls from "../../features/recording-controls/components/recording-controls";
import RecordingInputs from "../../features/recording-inputs/components/recording-inputs";
import { usePermissionsStore } from "../../stores/permissions.store";
import {
  useWindowReopenStore,
  Window,
} from "../../stores/window-open-state.store";
import { Events } from "../../types/events";

const StartRecordingDock = () => {
  const [{ accessibility, screen }, canUnlock] = usePermissionsStore(
    useShallow((state) => [state.permissions, state.canUnlock])
  );

  const [addWindow, setWindowOpenState] = useWindowReopenStore(
    useShallow((state) => [state.addWindow, state.setWindowOpenState])
  );

  const noPermissions =
    !accessibility?.hasAccess || !screen?.hasAccess || !canUnlock;

  useEffect(() => {
    addWindow(Window.StartRecordingDock);

    const unlisten = listen(Events.StartRecordingDockOpened, () => {
      setWindowOpenState(Window.StartRecordingDock, true);
    });

    return () => {
      void unlisten.then((f) => {
        f();
      });
    };
  }, []);

  return (
    <div
      className={clsx(
        "p-2 w-full flex flex-col gap-2 rounded-lg",
        noPermissions && "bg-content"
      )}
    >
      <Overlay blur="sm" className="rounded-lg" isOpen={noPermissions}>
        <div className="text-content-fg">
          <Lock />
        </div>
      </Overlay>

      <RecordingControls />
      <RecordingInputs />
    </div>
  );
};

export default StartRecordingDock;
