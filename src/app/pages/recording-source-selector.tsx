import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  collapseRecordingSourceSelector,
  expandRecordingSourceSelector,
} from "../../api/windows";
import RecordingSource from "../../features/recording-source/components/recording-source";
import {
  AppWindow,
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

  return (
    <div className="flex flex-row p-2 h-[100vh] w-full items-end justify-center">
      <RecordingSource onPress={onToggle} />
    </div>
  );
};

export default RecordingSourceSelector;
