import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  collapseRecordingSourceSelector,
  expandRecordingSourceSelector,
} from "../../api/windows";
import Button from "../../components/button/button";
import {
  AppWindow,
  rehydrateWindowReopenState,
  useWindowReopenStore,
} from "../../stores/window-open-state.store";
import { Events } from "../../types/events";

const RecordingSourceSelector = () => {
  const startRecordingDockOpened = useWindowReopenStore(
    useShallow((state) => state.windows[AppWindow.StartRecordingDock])
  );

  const [isExpanded, setIsExpanded] = useState(false);

  const onToggle = () => {
    // Invert the state
    if (isExpanded) collapseRecordingSourceSelector();
    else expandRecordingSourceSelector();
    setIsExpanded((prev) => !prev);
  };

  useEffect(() => {
    const unlisten = listen(Events.CollapsedRecordingSourceSelector, () => {
      setIsExpanded(false);
    });

    return () => {
      void unlisten.then((f) => {
        f();
      });
    };
  }, []);

  useEffect(() => {
    setIsExpanded(false);
  }, [startRecordingDockOpened]);

  useEffect(() => {
    window.addEventListener("storage", rehydrateWindowReopenState);
    return () => {
      window.removeEventListener("storage", rehydrateWindowReopenState);
    };
  }, []);

  return (
    <div className="h-[100vh] flex flex-row p-2 gap-2 items-center justify-center">
      <span className="text-xs text-muted font-semibold">Monitor:</span>
      <Button
        className="w-40 justify-center"
        onPress={onToggle}
        showFocus={false}
        size="sm"
      >
        Built-In Display
      </Button>
    </div>
  );
};

export default RecordingSourceSelector;
