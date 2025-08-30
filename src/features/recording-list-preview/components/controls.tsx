import { ClockAlert, HardDrive, Trash } from "lucide-react";
import { DialogTrigger } from "react-aria-components";

import { Badge } from "../../../components/base/badge/badge";
import { Button } from "../../../components/base/button/button";
import { ToggleButton } from "../../../components/base/button/toggle-button";
import { Popover } from "../../../components/base/popover/popover";
import { formatBytes, oneGB, pluralize } from "../../../lib/format";
import { cn } from "../../../lib/styling";
import { RecordingMetadata } from "../../recordings-list/api/recordings";

type DeleteButtonProps = {
  isDisabled?: boolean;
  onPress?: () => void;
};

const DeleteButton = ({ isDisabled, onPress }: DeleteButtonProps) => {
  return (
    <Button
      aria-label="Delete selected recordings"
      color="error"
      isDisabled={isDisabled}
      onPress={onPress}
      size="sm"
      variant="ghost"
      icon
    >
      <Trash className="translate-y-0" />
    </Button>
  );
};

type ControlsProps = {
  selected: RecordingMetadata[];
  className?: string;
  onDelete?: () => void;
  onHardDelete?: () => void;
  recentlyDeletedVisible?: boolean;
  setRecentlyDeletedVisible?: (isVisible: boolean) => void;
};

export const Controls = ({
  className,
  onDelete,
  onHardDelete,
  recentlyDeletedVisible,
  selected,
  setRecentlyDeletedVisible,
}: ControlsProps) => {
  const totalSelectedSize = selected.reduce(
    (acc, { sizeBytes }) => acc + (sizeBytes ?? 0),
    0
  );

  return (
    <div
      className={cn("flex items-center justify-between w-full px-2", className)}
    >
      <div className="flex items-center gap-2">
        <ToggleButton
          className="gap-2"
          color="error"
          defaultSelected={false}
          isSelected={recentlyDeletedVisible}
          onChange={setRecentlyDeletedVisible}
          size="sm"
        >
          <ClockAlert size={14} />
          Recently Deleted
        </ToggleButton>
      </div>

      <div className="flex items-center gap-2">
        {selected.length > 0 && totalSelectedSize > 0 && (
          <Badge
            color={totalSelectedSize > oneGB ? "warning" : "neutral"}
            size="sm"
          >
            <HardDrive size={12} />
            {formatBytes(totalSelectedSize)}
          </Badge>
        )}

        {!recentlyDeletedVisible && (
          <DeleteButton isDisabled={selected.length === 0} onPress={onDelete} />
        )}

        {recentlyDeletedVisible && (
          <DialogTrigger>
            <DeleteButton isDisabled={selected.length === 0} />

            <Popover className="flex flex-col gap-2 p-2 max-w-xs">
              <span className="text-sm text-content-fg">
                Delete {pluralize("recording", selected.length)} permanently?
              </span>

              <Button
                className="self-end"
                color="error"
                onPress={onHardDelete}
                size="sm"
                variant="ghost"
              >
                <Trash size={14} />
                Delete
              </Button>
            </Popover>
          </DialogTrigger>
        )}
      </div>
    </div>
  );
};
