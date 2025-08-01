import { Pause, Play, SkipBack, Upload } from "lucide-react";
import { useMemo } from "react";
import { Group } from "react-aria-components";
import { useHotkeys } from "react-hotkeys-hook";
import { useShallow } from "zustand/react/shallow";

import { Button } from "../../../components/button/button";
import { ToggleButton } from "../../../components/button/toggle-button";
import { HotkeyTooltip } from "../../../components/shared/hotkey-tooltip/hotkey-tooltip";
import { cn } from "../../../lib/styling";
import { formatTime } from "../../../lib/time";
import { usePlaybackStore } from "../../../stores/editor/playback.store";
import {
  AvailableActions,
  useHotkeyStore,
} from "../../../stores/hotkeys.store";

const controlButtonStyles =
  "transition-transform transform data-[pressed]:scale-105 data-[hovered]:scale-110";

const iconSize = 16;

const splitLeadingZeros = (time: string) => {
  let i = 0;
  while (
    i < time.length &&
    (time[i] === "0" || time[i] === ":" || time[i] === ".")
  ) {
    i++;
  }

  return {
    muted: time.slice(0, i),
    normal: time.slice(i),
  };
};

type ToolbarProps = {
  hotkeysEnabled: boolean;
  openExportOptions: () => void;
};

export const Toolbar = ({
  hotkeysEnabled,
  openExportOptions,
}: ToolbarProps) => {
  const getHotkey = useHotkeyStore(useShallow((state) => state.getHotkey));

  const [playing, currentTime, seek, togglePlay] = usePlaybackStore(
    useShallow((state) => [
      state.playing,
      state.currentTime,
      state.seek,
      state.togglePlay,
    ])
  );

  const time = useMemo(() => {
    const formatted = formatTime(currentTime);
    return splitLeadingZeros(
      `${formatted.hrs}:${formatted.mins}:${formatted.secs}.${formatted.ms}`
    );
  }, [currentTime]);

  const backToStart = () => {
    seek(0);
  };

  useHotkeys(getHotkey(AvailableActions.EditorBackToStart), backToStart, {
    enabled: hotkeysEnabled,
  });
  useHotkeys(getHotkey(AvailableActions.EditorTogglePlay), togglePlay, {
    enabled: hotkeysEnabled,
  });
  useHotkeys(getHotkey(AvailableActions.EditorExport), openExportOptions, {
    enabled: hotkeysEnabled,
  });

  return (
    <div className="flex flex-row justify-center py-0.5 relative">
      <Group className="flex flex-row items-center">
        <HotkeyTooltip hotkey={getHotkey(AvailableActions.EditorBackToStart)}>
          <Button onPress={backToStart} size="sm" variant="ghost" icon>
            {/* Scaling to match height of play icon, inconsistent Lucide icon design */}
            <SkipBack
              className="fill-content-fg scale-115"
              size={iconSize - 1}
            />
          </Button>
        </HotkeyTooltip>

        <HotkeyTooltip hotkey={getHotkey(AvailableActions.EditorTogglePlay)}>
          <ToggleButton
            className="w-6 h-6"
            isSelected={playing}
            onPress={togglePlay}
            off={
              <Play
                className="fill-content-fg stroke-content-fg"
                size={iconSize}
              />
            }
            on={
              <Pause
                className="fill-content-fg stroke-content-fg"
                size={iconSize}
              />
            }
          />
        </HotkeyTooltip>

        <span className="text-lg tabular-nums font-light select-none w-[100px]">
          <span className="text-muted font-thin">{time.muted}</span>
          <span>{time.normal}</span>
        </span>
      </Group>

      <Group className="flex flex-row items-center absolute right-2 top-0 bottom-0">
        <HotkeyTooltip hotkey={getHotkey(AvailableActions.EditorExport)}>
          <Button
            onPress={openExportOptions}
            variant="ghost"
            className={cn(
              controlButtonStyles,
              "p-1",
              "text-xs",
              "font-light",
              "text-muted"
            )}
          >
            Export
            <Upload className="text-content-fg" size={iconSize} />
          </Button>
        </HotkeyTooltip>
      </Group>
    </div>
  );
};
