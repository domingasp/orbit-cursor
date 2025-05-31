import { AppWindowMac, Monitor } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import Button from "../../../components/button/button";
import ContentRotate from "../../../components/content-rotate/content-rotate";
import {
  RecordingType,
  useRecordingPreferencesStore,
} from "../../../stores/recording-preferences.store";

type RecordingSourceProps = {
  onPress: () => void;
};
const RecordingSource = ({ onPress }: RecordingSourceProps) => {
  const [recordingType, selectedMonitor] = useRecordingPreferencesStore(
    useShallow((state) => [state.recordingType, state.selectedMonitor])
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
        className="w-36 justify-center"
        onPress={onPress}
        showFocus={false}
        size="sm"
      >
        <ContentRotate
          className="truncate"
          contentKey={selectedMonitor?.id ?? ""}
        >
          {selectedMonitor?.name ?? "None"}
        </ContentRotate>
      </Button>
    </div>
  );
};

export default RecordingSource;
