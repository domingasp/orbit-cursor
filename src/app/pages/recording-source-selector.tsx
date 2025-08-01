import { LogicalSize } from "@tauri-apps/api/dpi";
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
  listWindows,
  MonitorDetails,
  WindowDetails,
} from "../../features/recording-source/api/recording-sources";
import { MonitorSelector } from "../../features/recording-source/components/monitor-selector";
import { RecordingSource } from "../../features/recording-source/components/recording-source";
import { SelectorWrapper } from "../../features/recording-source/components/selector-wrapper";
import { WindowSelector } from "../../features/recording-source/components/window-selector";
import {
  RecordingType,
  useRecordingStateStore,
} from "../../stores/recording-state.store";
import {
  AppWindow,
  useWindowReopenStore,
} from "../../stores/window-open-state.store";
import { Events } from "../../types/events";

export const RecordingSourceSelector = () => {
  const startRecordingDockOpened = useWindowReopenStore(
    useShallow((state) => state.windows[AppWindow.StartRecordingDock])
  );
  const [
    selectedMonitor,
    setSelectedMonitor,
    selectedWindow,
    setSelectedWindow,
    recordingType,
  ] = useRecordingStateStore(
    useShallow((state) => [
      state.selectedMonitor,
      state.setSelectedMonitor,
      state.selectedWindow,
      state.setSelectedWindow,
      state.recordingType,
    ])
  );

  const [isExpanded, setIsExpanded] = useState(false);

  const onSelect = (source: MonitorDetails | WindowDetails | null) => {
    if (source === null || "thumbnailPath" in source) {
      setSelectedWindow(source);
    } else {
      setSelectedMonitor(source);
    }
    if (source !== null) {
      setIsExpanded(false);
      collapseRecordingSourceSelector();
    }
  };

  const onToggle = () => {
    // Invert the state
    if (isExpanded) collapseRecordingSourceSelector();
    else
      expandRecordingSourceSelector(
        recordingType === RecordingType.Window
          ? new LogicalSize(750, 500)
          : undefined
      );
    setIsExpanded((prev) => !prev);
  };

  useEffect(() => {
    if (startRecordingDockOpened) {
      void listMonitors().then((monitors) => {
        if (
          selectedMonitor === null ||
          (!monitors.find((monitor) => monitor.id === selectedMonitor.id) &&
            monitors.length > 0)
        ) {
          setSelectedMonitor(monitors[0]);
        }
      });

      if (selectedWindow !== null) {
        void listWindows(isExpanded).then((windows) => {
          const doesSelectedExist =
            windows.findIndex((x) => x.id === selectedWindow.id) > -1;
          if (!doesSelectedExist) setSelectedWindow(null);
        });
      }
    }
  }, [startRecordingDockOpened, isExpanded]);

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
      {isExpanded &&
        (recordingType === RecordingType.Window ? (
          <SelectorWrapper className="overflow-auto items-start">
            <WindowSelector
              isExpanded={isExpanded}
              onSelect={onSelect}
              selectedWindow={selectedWindow}
            />
          </SelectorWrapper>
        ) : (
          <SelectorWrapper>
            <MonitorSelector
              onSelect={onSelect}
              selectedMonitor={selectedMonitor}
            />
          </SelectorWrapper>
        ))}

      <RecordingSource onPress={onToggle} />
    </div>
  );
};
