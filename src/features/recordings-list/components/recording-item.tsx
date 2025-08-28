import {
  AppWindowMac,
  Clock,
  HardDrive,
  Monitor,
  SquareDashed,
} from "lucide-react";
import { Checkbox } from "react-aria-components";

import { tv } from "../../../../tailwind-merge.config";
import { Badge } from "../../../components/base/badge/badge";
import { RecordingType } from "../../../stores/recording-state.store";
import { RecordingMetadata } from "../api/recordings";

const recordingTypeIcons: Record<RecordingType, React.ReactNode> = {
  [RecordingType.Screen]: <Monitor size={18} />,
  [RecordingType.Region]: <SquareDashed size={18} />,
  [RecordingType.Window]: <AppWindowMac size={18} />,
};

const oneGB = 1024 ** 3;

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(1)} ${units[i]}`;
};

const formatMilliseconds = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const recordingItemVariants = tv({
  slots: {
    base: [
      "flex flex-col items-start w-full p-2 rounded-lg gap-1.5",
      "text-content-fg bg-neutral/33 shadow-xs transition-[box-shadow,background-color]",
      "border-1 border-muted/15",
      "data-[hovered]:bg-neutral/66",
    ],
    metadata: "flex flex-row items-center gap-1",
    metadataWrapper:
      "flex items-end w-full justify-between gap-1 text-muted text-xs font-light flex-shrink-0",
    title: "text-left flex-1 min-w-0 truncate",
    titleWrapper: "flex text-sm gap-1.5 items-center w-full min-w-0",
  },
  variants: {
    selected: {
      true: {
        base: "ring-2 ring-offset-1 ring-offset-content ring-info",
      },
    },
  },
});

type RecordingItemProps = {
  recording: RecordingMetadata;
};

export const RecordingItem = ({ recording }: RecordingItemProps) => {
  const { base, metadata, metadataWrapper, title, titleWrapper } =
    recordingItemVariants();

  return (
    <Checkbox className={({ isSelected }) => base({ selected: isSelected })}>
      <div className={titleWrapper()}>
        {recording.type && recordingTypeIcons[recording.type]}
        <span className={title()}>{recording.name}</span>
      </div>

      <div className={metadataWrapper()}>
        <div className={metadata()}>
          {recording.lengthMs && (
            <Badge className="w-20" size="sm">
              <Clock size={12} />
              {formatMilliseconds(recording.lengthMs)}
            </Badge>
          )}
          {recording.sizeBytes && (
            <Badge
              color={recording.sizeBytes > oneGB ? "warning" : "neutral"}
              size="sm"
            >
              <HardDrive size={12} />
              {formatBytes(recording.sizeBytes)}
            </Badge>
          )}
        </div>

        {recording.createdAt.toLocaleString()}
      </div>
    </Checkbox>
  );
};
