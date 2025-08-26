import { AppWindowMac, Monitor, SquareDashed } from "lucide-react";
import { ComponentProps } from "react";
import { useShallow } from "zustand/react/shallow";

import { Keyboard } from "../../../components/base/keyboard/keyboard";
import { RadioGroup } from "../../../components/base/radio-group/radio-group";
import {
  RecordingType,
  useRecordingStateStore,
} from "../../../stores/recording-state.store";

import { IconRadio } from "./icon-radio";

const KEYBOARD_STYLE: ComponentProps<typeof Keyboard> = {
  size: "xs",
  variant: "ghost",
};

export const RecordingTypeRadioGroup = () => {
  const [recordingType, setRecordingType] = useRecordingStateStore(
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
        aria-label="Screen"
        icon={<Monitor size={30} />}
        shortcut={<Keyboard {...KEYBOARD_STYLE}>1</Keyboard>}
        subtext="Screen"
        value={RecordingType.Screen}
      />

      <IconRadio
        aria-label="Region"
        icon={<SquareDashed size={30} />}
        shortcut={<Keyboard {...KEYBOARD_STYLE}>2</Keyboard>}
        subtext="Region"
        value={RecordingType.Region}
      />

      <IconRadio
        aria-label="Window"
        icon={<AppWindowMac size={30} />}
        shortcut={<Keyboard {...KEYBOARD_STYLE}>3</Keyboard>}
        subtext="Window"
        value={RecordingType.Window}
      />
    </RadioGroup>
  );
};
