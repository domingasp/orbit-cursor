import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  collapseRecordingSourceSelector,
  expandRecordingSourceSelector,
} from "../../api/windows";
import RecordingSource from "../../features/recording-source/components/recording-source";
import { rehydrateRecordingPreferencesStore } from "../../stores/recording-preferences.store";
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

  const rehydrateStores = (e: StorageEvent) => {
    rehydrateWindowReopenState(e);
    rehydrateRecordingPreferencesStore(e);
  };

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
    window.addEventListener("storage", rehydrateStores);
    return () => {
      window.removeEventListener("storage", rehydrateStores);
    };
  }, []);

  return (
    <div className="flex flex-row p-2 h-[100vh] w-full items-end justify-center">
      <RecordingSource onPress={onToggle} />
    </div>
  );
};

export default RecordingSourceSelector;
