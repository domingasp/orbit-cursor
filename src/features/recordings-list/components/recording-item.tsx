import {
  AppWindowMac,
  Camera,
  Clock,
  HardDrive,
  Mic,
  Monitor,
  MousePointer,
  SquareDashed,
  Volume2,
} from "lucide-react";
import { Checkbox } from "react-aria-components";
import Highlighter from "react-highlight-words";

import { tv } from "../../../../tailwind-merge.config";
import { Badge } from "../../../components/base/badge/badge";
import {
  formatBytes,
  formatMilliseconds,
  oneGB,
  retentionTag,
} from "../../../lib/format";
import { RecordingType } from "../../../stores/recording-state.store";
import { RecordingMetadata } from "../api/recordings";

const RetentionBadge = ({
  deletedAt,
  retentionInDays = 30,
}: {
  deletedAt: Date;
  retentionInDays: number;
}) => {
  const { formatted, unit, value } = retentionTag(deletedAt, retentionInDays);

  return (
    <Badge
      className="w-full"
      color={unit !== "days" || value <= 5 ? "error" : "neutral"}
      size="sm"
    >
      {formatted} remaining
    </Badge>
  );
};

const recordingTypeIcons: Record<RecordingType, React.ReactNode> = {
  [RecordingType.Screen]: <Monitor size={18} />,
  [RecordingType.Region]: <SquareDashed size={18} />,
  [RecordingType.Window]: <AppWindowMac size={18} />,
};

const recordingItemVariants = tv({
  compoundVariants: [
    { class: { base: "ring-error" }, deleted: true, selected: true },
  ],
  slots: {
    base: [
      "relative flex flex-col items-start w-full p-2 rounded-lg gap-1.5",
      "text-content-fg bg-neutral/33 shadow-xs transition-[box-shadow,background-color]",
      "border-1 border-muted/15",
      "data-[hovered]:bg-neutral/66",
    ],
    metadata: "flex flex-row flex-wrap items-center gap-1",
    metadataWrapper:
      "flex items-end w-full justify-between gap-1 text-muted text-xs font-light flex-shrink-0 tabler-nums",
    title: "text-left flex-1 min-w-0 truncate",
    titleWrapper: "flex text-sm gap-1.5 items-center w-full min-w-0",
  },
  variants: {
    deleted: {
      true: {
        base: ["border-error/50", "data-[hovered]:bg-error/25"],
      },
    },
    isCurrentlyOpen: {
      true: {
        base: "border-warning",
      },
    },
    selected: {
      true: {
        base: "ring-2 ring-offset-1 ring-offset-content ring-info",
      },
    },
  },
});

type RecordingItemProps = {
  recording: RecordingMetadata;
  isCurrentlyOpen?: boolean;
  searchTerm?: string;
};

export const RecordingItem = ({
  isCurrentlyOpen,
  recording,
  searchTerm,
}: RecordingItemProps) => {
  const { base, metadata, metadataWrapper, title, titleWrapper } =
    recordingItemVariants({ deleted: !!recording.deletedAt, isCurrentlyOpen });

  return (
    <Checkbox
      className={({ isSelected }) => base({ selected: isSelected })}
      value={recording.id.toString()}
    >
      <div className={titleWrapper()}>
        {recording.type && recordingTypeIcons[recording.type]}
        <Highlighter
          className={title()}
          highlightClassName="bg-warning"
          searchWords={searchTerm ? [searchTerm] : []}
          textToHighlight={recording.name}
          autoEscape
        />

        <div className="flex flex-row gap-1.5 text-muted text-xs self-start">
          {recording.hasSystemAudio && <Volume2 size={12} />}
          {recording.hasMicrophone && <Mic size={12} />}
          {recording.hasCamera && <Camera size={12} />}
          {recording.hasSystemCursor && <MousePointer size={12} />}
        </div>
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

        <span className="shrink-0">{recording.createdAt.toLocaleString()}</span>
      </div>

      {recording.deletedAt && (
        <RetentionBadge deletedAt={recording.deletedAt} retentionInDays={30} />
      )}
    </Checkbox>
  );
};
