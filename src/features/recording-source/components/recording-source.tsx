import { convertFileSrc } from "@tauri-apps/api/core";
import { AppWindowMac, Monitor, SquareDashed } from "lucide-react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "../../../components/button/button";
import { ContentRotate } from "../../../components/content-rotate/content-rotate";
import {
  RecordingType,
  useRecordingStateStore,
} from "../../../stores/recording-state.store";
import { useRegionSelectorStore } from "../../../stores/region-selector.store";

type RecordingSourceProps = {
  onPress: () => void;
};

export const RecordingSource = ({ onPress }: RecordingSourceProps) => {
  const [recordingType, selectedMonitor, selectedWindow] =
    useRecordingStateStore(
      useShallow((state) => [
        state.recordingType,
        state.selectedMonitor,
        state.selectedWindow,
      ])
    );
  const setIsEditingRegion = useRegionSelectorStore(
    useShallow((state) => state.setIsEditing)
  );

  const isWindowSelector = useMemo(
    () => recordingType === RecordingType.Window,
    [recordingType]
  );

  return (
    <div className="flex flex-row gap-2 items-center justify-center">
      <ContentRotate
        className=" flex gap-2 items-center text-xxs justify-center text-muted font-semibold w-16"
        contentKey={
          recordingType === RecordingType.Window ? "window" : "monitor"
        }
      >
        {recordingType === RecordingType.Window ? (
          <>
            <AppWindowMac size={12} />
            Window
          </>
        ) : (
          <>
            <Monitor size={12} />
            Monitor
          </>
        )}
      </ContentRotate>

      <Button
        className="w-36 justify-center p-1"
        onPress={onPress}
        showFocus={false}
        size="sm"
      >
        <ContentRotate
          className="truncate"
          contentKey={
            (isWindowSelector
              ? selectedWindow?.id.toString()
              : selectedMonitor?.id) ?? ""
          }
        >
          {isWindowSelector &&
            (selectedWindow?.id ? (
              <div className="flex flex-row items-center gap-1">
                {selectedWindow.appIconPath && (
                  <img
                    src={convertFileSrc(selectedWindow.appIconPath)}
                    width={16}
                  />
                )}
                <span className="truncate">{selectedWindow.title}</span>
              </div>
            ) : (
              "None"
            ))}

          {!isWindowSelector && (selectedMonitor?.name ?? "None")}
        </ContentRotate>
      </Button>

      {recordingType === RecordingType.Region && (
        <Button
          showFocus={false}
          size="sm"
          onPress={() => {
            setIsEditingRegion(true);
          }}
        >
          <SquareDashed size={14} />
          Edit
        </Button>
      )}
    </div>
  );
};
