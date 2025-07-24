import { Pause, Play, SkipBack, Upload } from "lucide-react";
import { AnimatePresence, motion, MotionProps } from "motion/react";
import { useMemo } from "react";
import { Group } from "react-aria-components";
import { useHotkeys } from "react-hotkeys-hook";
import { useShallow } from "zustand/react/shallow";

import Button from "../../../components/button/button";
import HotkeyTooltip from "../../../components/shared/hotkey-tooltip/hotkey-tooltip";
import { cn } from "../../../lib/styling";
import { formatTime } from "../../../lib/time";
import { usePlaybackStore } from "../../../stores/editor/playback.store";
import {
  AvailableActions,
  useHotkeyStore,
} from "../../../stores/hotkeys.store";

const controlButtonStyles =
  "cursor-default relative p-1 transition-transform transform data-[pressed]:scale-105 data-[hovered]:scale-110 justify-center";

const iconSize = 18;

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

const toggleAnimationProps: MotionProps = {
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0 },
  initial: { opacity: 0, scale: 0 },
};

type ToolbarProps = {
  hotkeysEnabled: boolean;
  openExportOptions: () => void;
};
const Toolbar = ({ hotkeysEnabled, openExportOptions }: ToolbarProps) => {
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
          <Button
            className={controlButtonStyles}
            onPress={backToStart}
            variant="ghost"
          >
            {/* Scaling to match height of play icon, inconsistent Lucide icon design */}
            <SkipBack className="fill-content-fg scale-115" size={iconSize} />
          </Button>
        </HotkeyTooltip>

        <HotkeyTooltip hotkey={getHotkey(AvailableActions.EditorTogglePlay)}>
          <Button
            className={controlButtonStyles}
            onPress={togglePlay}
            variant="ghost"
          >
            <div className="invisible">
              <Pause size={iconSize} />
            </div>

            <AnimatePresence>
              {playing ? (
                <motion.div
                  key="pause"
                  {...toggleAnimationProps}
                  className="absolute"
                >
                  <Pause className="fill-content-fg" size={iconSize} />
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  {...toggleAnimationProps}
                  className="absolute"
                >
                  <Play className="fill-content-fg" size={iconSize} />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </HotkeyTooltip>

        <span className="text-lg tabular-nums font-light select-none">
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

export default Toolbar;
