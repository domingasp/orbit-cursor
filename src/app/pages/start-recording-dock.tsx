import { listen } from "@tauri-apps/api/event";
import clsx from "clsx";
import { Lock } from "lucide-react";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { isStartRecordingDockOpen } from "../../api/windows";
import { Overlay } from "../../components/overlay/overlay";
import { RecordingControls } from "../../features/recording-controls/components/recording-controls";
import { usePermissionsStore } from "../../stores/permissions.store";
import { useRecordingStateStore } from "../../stores/recording-state.store";
import {
  AppWindow,
  useWindowReopenStore,
} from "../../stores/window-open-state.store";
import { Events } from "../../types/events";

export const StartRecordingDock = () => {
  const [{ accessibility, screen }, canUnlock] = usePermissionsStore(
    useShallow((state) => [state.permissions, state.canUnlock])
  );

  const [addWindow, setWindowOpenState] = useWindowReopenStore(
    useShallow((state) => [state.addWindow, state.setWindowOpenState])
  );

  const [setIsRecording, setIsPaused] = useRecordingStateStore(
    useShallow((state) => [state.setIsRecording, state.setIsPaused])
  );

  const noPermissions =
    !accessibility.hasAccess || !screen.hasAccess || !canUnlock;

  useEffect(() => {
    setIsRecording(false); // On first mount reset recording state
    setIsPaused(false);

    const addWindowToStore = async () => {
      addWindow(AppWindow.StartRecordingDock, await isStartRecordingDockOpen());
    };
    void addWindowToStore();

    const unlisten = listen(Events.StartRecordingDockOpened, () => {
      setWindowOpenState(AppWindow.StartRecordingDock, true);
      setIsRecording(false);
      setIsPaused(false);
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
    </div>
  );
};
