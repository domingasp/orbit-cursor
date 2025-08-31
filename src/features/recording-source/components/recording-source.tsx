import { convertFileSrc } from "@tauri-apps/api/core";
import { AppWindowMac, Monitor, SquareDashed } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "../../../components/base/button/button";
import { ContentRotate } from "../../../components/base/content-rotate/content-rotate";
import {
  recordingType as recordingTypeOptions,
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
    () => recordingType === recordingTypeOptions.WINDOW,
    [recordingType]
  );

  return (
    <div className="w-full max-w-[284px] min-h-[24px] flex flex-row gap-2 items-center justify-center overflow-hidden">
      <ContentRotate
        className="flex gap-2 items-center text-xxs justify-center text-muted font-semibold"
        containerClassName="min-w-16"
        contentKey={
          recordingType === recordingTypeOptions.WINDOW ? "window" : "monitor"
        }
      >
        {recordingType === recordingTypeOptions.WINDOW ? (
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

      <motion.div
        className="flex grow max-w-[211px] gap-2 overflow-hidden"
        transition={{ duration: 0.2, ease: "linear" }}
        layout
      >
        <motion.div
          className="flex flex-1 min-w-0"
          transition={{ duration: 0.2, ease: "linear" }}
          layout
        >
          <Button
            className="w-full justify-center p-1"
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
        </motion.div>

        <AnimatePresence mode="popLayout">
          {recordingType === recordingTypeOptions.REGION && (
            <Button
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0, x: 100 }}
              showFocus={false}
              size="sm"
              style={{ overflow: "hidden" }}
              transition={{ duration: 0.12, ease: "linear" }}
              onPress={() => {
                setIsEditingRegion(true);
              }}
            >
              <SquareDashed size={14} />
              Edit
            </Button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
