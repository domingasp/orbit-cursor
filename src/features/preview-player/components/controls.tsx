import { Pause, Play, SkipBack } from "lucide-react";
import { AnimatePresence, motion, MotionProps } from "motion/react";
import { useMemo } from "react";

import Button from "../../../components/button/button";
import { formatTime } from "../../../lib/time";

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
      <Button
        className={controlButtonStyles}
        onPress={onBackToStart}
        variant="ghost"
      >
        <SkipBack className="fill-content-fg" size={iconSize + 2} />
      </Button>

      <Button
        className={controlButtonStyles}
        onPress={onTogglePlay}
        variant="ghost"
      >
        <div className="invisible">
          <Pause />
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

      <span className="text-lg tabular-nums font-light select-none">
        <span className="text-muted font-thin">{time.muted}</span>
        <span>{time.normal}</span>
      </span>
    </div>
  );
};

export default Controls;
