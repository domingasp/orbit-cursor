import { LogicalSize, PhysicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import clsx from "clsx";
import {
  Info,
  PencilLine,
  SquareBottomDashedScissors,
  SquareDot,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  collapseRecordingSourceSelector,
  expandRecordingSourceSelector,
} from "../../api/windows";
import { AspectRatio } from "../../components/shared/aspect-ratio/aspect-ratio";
import { CheckOnClickButton } from "../../components/shared/check-on-click-button/check-on-click-button";
import {
  listMonitors,
  listWindows,
  MonitorDetails,
  makeBorderless,
  centerWindow,
  restoreBorder,
  resizeWindow,
  WindowDetails,
} from "../../features/recording-source/api/recording-sources";
import { MonitorSelector } from "../../features/recording-source/components/monitor-selector";
import { RecordingSource } from "../../features/recording-source/components/recording-source";
import { SelectorWrapper } from "../../features/recording-source/components/selector-wrapper";
import { WindowSelector } from "../../features/recording-source/components/window-selector";
import { getPlatform } from "../../stores/hotkeys.store";
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
  const [windows, setWindows] = useState<WindowDetails[]>([]);

  const onSelect = (source: MonitorDetails | WindowDetails | null) => {
    if (source === null || "thumbnailPath" in source) {
      setSelectedWindow(source);
    } else {
      setSelectedMonitor(source);
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
        listWindows(false); // Refetch windows anytime dock is reopened
      }
    }
  }, [startRecordingDockOpened]);

  useEffect(() => {
    const unlisten = listen(Events.WindowThumbnailsGenerated, (result) => {
      // Fetching here due to conditional rendering, we need to verify
      // window still exists on reloading
      const windowResults = result.payload as WindowDetails[];
      setWindows(windowResults);

      if (selectedWindow) {
        const doesSelectedExist =
          windowResults.findIndex((x) => x.id === selectedWindow.id) > -1;
        if (!doesSelectedExist) setSelectedWindow(null);
      }
    });

    return () => {
      void unlisten.then((f) => {
        f();
      });
    };
  }, []);

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
              windows={windows}
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

      {isExpanded && recordingType === RecordingType.Window && (
        <div className="relative w-full flex flex-col items-center gap-2">
          <AspectRatio
            onApply={(width, height) => {
              if (selectedWindow === null) return;
              resizeWindow(
                selectedWindow.pid,
                selectedWindow.title,
                new PhysicalSize(width, height)
              );
            }}
          />
          <span className="flex flex-row items-center text-xxs text-muted gap-1 font-extralight">
            <Info size={10} /> Apps may impose own sizing restrictions.
          </span>

          <div className="absolute left-0 top-0">
            <CheckOnClickButton
              size="sm"
              variant="ghost"
              onPress={() => {
                if (!selectedWindow) return;
                centerWindow(selectedWindow.pid, selectedWindow.title);
              }}
            >
              <SquareDot size={14} />
              Center
            </CheckOnClickButton>
          </div>

          {getPlatform() === "windows" && (
            <div className="absolute right-0 top-0 flex flex-col items-end gap-2">
              <CheckOnClickButton
                size="sm"
                variant="ghost"
                onPress={() => {
                  if (!selectedWindow) return;
                  makeBorderless(selectedWindow.pid, selectedWindow.title);
                }}
              >
                <SquareBottomDashedScissors size={14} />
                Borderless
              </CheckOnClickButton>

              <CheckOnClickButton
                size="sm"
                variant="ghost"
                onPress={() => {
                  if (!selectedWindow) return;
                  restoreBorder(selectedWindow.pid, selectedWindow.title);
                }}
              >
                <PencilLine size={14} />
                Restore Border
              </CheckOnClickButton>
            </div>
          )}
        </div>
      )}

      <RecordingSource onPress={onToggle} />
    </div>
  );
};
