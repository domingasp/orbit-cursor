import { ArrowLeft } from "lucide-react";
import { Heading } from "react-aria-components";

import { Button } from "../../../components/base/button/button";

type TitlebarProps = {
  selected: string[];
  currentlyOpenId?: number;
  onCancel?: () => void;
  onClear?: () => void;
  onOpen?: (recordingId: number) => void;
  onRestore?: () => void;
  recentlyDeletedVisible?: boolean;
};

export const Titlebar = ({
  currentlyOpenId,
  onCancel,
  onClear,
  onOpen,
  onRestore,
  recentlyDeletedVisible,
  selected,
}: TitlebarProps) => {
  return (
    <div className="flex items-center justify-between pr-2 py-1">
      <div className="flex items-center gap-1">
        <Button
          aria-label="Close"
          onPress={onCancel}
          size="sm"
          variant="ghost"
          icon
        >
          <ArrowLeft size={18} />
        </Button>

        <Heading className="font-light">Recordings</Heading>
      </div>

      <div className="flex gap-1">
        <Button
          className="font-light"
          color="muted"
          isDisabled={selected.length === 0}
          onPress={onClear}
          size="sm"
          variant="ghost"
        >
          Clear Selection
        </Button>

        <Button
          color="info"
          size="sm"
          variant="soft"
          isDisabled={
            selected.length === 0 ||
            // Open is single only, Restore can be done in bulk
            (!recentlyDeletedVisible &&
              (selected.length > 1 ||
                selected[0] === currentlyOpenId?.toString()))
          }
          onPress={() => {
            if (recentlyDeletedVisible && onRestore) {
              onRestore();
            } else if (selected.length === 1 && onOpen) {
              onOpen(Number(selected[0]));
            }
          }}
        >
          {recentlyDeletedVisible ? "Restore" : "Open"}
        </Button>
      </div>
    </div>
  );
};
