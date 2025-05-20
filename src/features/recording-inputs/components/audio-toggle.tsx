import Switch from "../../../components/switch/switch";
import { cn } from "../../../lib/styling";
import { AudioStream } from "../api/audio-listeners";

import AudioMeter from "./audio-meter";

type AudioToggleProps = {
  decibels: number | undefined;
  label: string;
  streamName: AudioStream;
  icon?: React.ReactNode;
  onChange?: (value: boolean) => void;
  value?: boolean;
};
const AudioToggle = ({
  decibels,
  icon,
  label,
  onChange,
  value,
}: AudioToggleProps) => {
  return (
    <div className="flex flex-col gap-1 grow basis-0">
      <div className="flex flex-row gap-2">
        <Switch
          className="justify-between w-full pl-2 py-1"
          isSelected={value}
          onChange={onChange}
          size="xs"
        >
          <div
            className={cn(
              "flex flex-row gap-2 transition-colors",
              value ? "text-content-fg" : "text-muted/75"
            )}
          >
            {icon}
            {label}
          </div>
        </Switch>
      </div>

      <AudioMeter
        decibels={decibels ?? -Infinity}
        disabled={!value}
        disabledIcon={null}
        height={5}
        orientation="horizontal"
        width="100%"
      />
    </div>
  );
};

export default AudioToggle;
