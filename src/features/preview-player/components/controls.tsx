import { Pause, Play, SkipBack } from "lucide-react";
import { AnimatePresence, motion, MotionProps } from "motion/react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import Button from "../../../components/button/button";
import HotkeyTooltip from "../../../components/shared/hotkey-tooltip/hotkey-tooltip";
import { formatTime } from "../../../lib/time";
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

type ControlsProps = {
  currentTime: number;
  isPlaying: boolean;
  onBackToStart: () => void;
  onTogglePlay: () => void;
};
const Controls = ({
  currentTime,
  isPlaying,
  onBackToStart,
  onTogglePlay,
}: ControlsProps) => {
  const getHotkey = useHotkeyStore(useShallow((state) => state.getHotkey));

  const animationProps: MotionProps = {
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0 },
    initial: { opacity: 0, scale: 0 },
  };

  const time = useMemo(() => {
    const formatted = formatTime(currentTime);
    return splitLeadingZeros(
      `${formatted.hrs}:${formatted.mins}:${formatted.secs}.${formatted.ms}`
    );
  }, [currentTime]);

  return (
    <div className="flex flex-row items-center">
      <HotkeyTooltip hotkey={getHotkey(AvailableActions.EditorBackToStart)}>
        <Button
          className={controlButtonStyles}
          onPress={onBackToStart}
          variant="ghost"
        >
          {/* Scaling to match height of play icon, inconsistent Lucide icon design */}
          <SkipBack className="fill-content-fg scale-115" size={iconSize} />
        </Button>
      </HotkeyTooltip>

      <HotkeyTooltip hotkey={getHotkey(AvailableActions.EditorTogglePlay)}>
        <Button
          className={controlButtonStyles}
          onPress={onTogglePlay}
          variant="ghost"
        >
          <div className="invisible">
            <Pause size={iconSize} />
          </div>

          <AnimatePresence>
            {isPlaying ? (
              <motion.div key="pause" {...animationProps} className="absolute">
                <Pause className="fill-content-fg" size={iconSize} />
              </motion.div>
            ) : (
              <motion.div key="play" {...animationProps} className="absolute">
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
    </div>
  );
};

export default Controls;
