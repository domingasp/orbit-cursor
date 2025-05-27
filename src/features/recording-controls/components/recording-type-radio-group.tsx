import { AppWindowMac, Monitor, SquareDashed } from "lucide-react";
import { ComponentProps } from "react";
import { useShallow } from "zustand/react/shallow";

import Keyboard from "../../../components/keyboard/keyboard";
import RadioGroup from "../../../components/radio-group/radio-group";
import {
  RecordingType,
  useRecordingPreferencesStore,
} from "../../../stores/recording-preferences.store";

import IconRadio from "./icon-radio";

const KEYBOARD_STYLE: ComponentProps<typeof Keyboard> = {
  size: "xs",
  variant: "ghost",
};

const RecordingTypeRadioGroup = () => {
  const [recordingType, setRecordingType] = useRecordingPreferencesStore(
    useShallow((state) => [state.recordingType, state.setRecordingType])
  );

  return (
    <RadioGroup
      aria-label="Recording type"
      className="grow"
      orientation="horizontal"
      value={recordingType}
      onChange={(value) => {
        setRecordingType(value as RecordingType);
      }}
    >
      <IconRadio
        aria-label="Region"
        icon={<SquareDashed size={30} />}
        shortcut={<Keyboard {...KEYBOARD_STYLE}>1</Keyboard>}
        subtext="Region"
        value={RecordingType.Region}
      />

      <IconRadio
        aria-label="Window"
        icon={<AppWindowMac size={30} />}
        shortcut={<Keyboard {...KEYBOARD_STYLE}>2</Keyboard>}
        subtext="Window"
        value={RecordingType.Window}
      />

      <IconRadio
        aria-label="Screen"
        icon={<Monitor size={30} />}
        shortcut={<Keyboard {...KEYBOARD_STYLE}>3</Keyboard>}
        subtext="Screen"
        value={RecordingType.Screen}
      />
    </RadioGroup>
  );
};

export default RecordingTypeRadioGroup;
