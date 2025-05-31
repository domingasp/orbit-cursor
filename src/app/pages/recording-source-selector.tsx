import { listen } from "@tauri-apps/api/event";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  collapseRecordingSourceSelector,
  expandRecordingSourceSelector,
} from "../../api/windows";
import {
  listMonitors,
  MonitorDetails,
} from "../../features/recording-source/api/recording-sources";
import MonitorSelector from "../../features/recording-source/components/monitor-selector";
import RecordingSource from "../../features/recording-source/components/recording-source";
import { useRecordingPreferencesStore } from "../../stores/recording-preferences.store";
import {
  AppWindow,
  useWindowReopenStore,
} from "../../stores/window-open-state.store";
import { Events } from "../../types/events";

const RecordingSourceSelector = () => {
  const startRecordingDockOpened = useWindowReopenStore(
    useShallow((state) => state.windows[AppWindow.StartRecordingDock])
  );
  const [selectedMonitor, setSelectedMonitor] = useRecordingPreferencesStore(
    useShallow((state) => [state.selectedMonitor, state.setSelectedMonitor])
  );

  const [isExpanded, setIsExpanded] = useState(false);

  const onSelect = (monitor: MonitorDetails) => {
    setSelectedMonitor(monitor);
    setIsExpanded(false);
    collapseRecordingSourceSelector();
  };

  const onToggle = () => {
    // Invert the state
    if (isExpanded) collapseRecordingSourceSelector();
    else expandRecordingSourceSelector();
    setIsExpanded((prev) => !prev);
  };

  useEffect(() => {
    void listMonitors().then((monitors) => {
      if (
        selectedMonitor === null ||
        (!monitors.find((monitor) => monitor.id === selectedMonitor.id) &&
          monitors.length > 0)
      ) {
        setSelectedMonitor(monitors[0]);
      }
    });
  }, [isExpanded]);

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
    <div
      className={clsx(
        "flex flex-col p-2 h-[100vh] w-full items-center justify-end",
        isExpanded && "gap-2"
      )}
    >
      {isExpanded && (
        <MonitorSelector
          onSelect={onSelect}
          selectedMonitor={selectedMonitor}
        />
      )}

      {startRecordingDockOpened && <RecordingSource onPress={onToggle} />}
    </div>
  );
};

export default RecordingSourceSelector;
