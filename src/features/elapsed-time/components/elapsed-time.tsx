import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../../../lib/styling";
import { formatTime } from "../../../lib/time";

import { NumberRotate } from "./number-rotate";

type ElapsedTimeProps = {
  isPaused: boolean;
  isRecording: boolean;
};

export const ElapsedTime = ({ isPaused, isRecording }: ElapsedTimeProps) => {
  const interval = useRef<NodeJS.Timeout>(null);
  const totalMs = useRef(0);
  const lastTick = useRef<number>(null);

  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const time = useMemo(() => formatTime(secondsElapsed), [secondsElapsed]);

  useEffect(() => {
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      if (interval.current) clearInterval(interval.current);
      interval.current = null;
      totalMs.current = 0;
      lastTick.current = null;
      setSecondsElapsed(0);
      return;
    }

    if (interval.current) clearInterval(interval.current);
    lastTick.current = Date.now();

    interval.current = setInterval(() => {
      const now = Date.now();

      if (!isPaused && lastTick.current !== null) {
        const delta = now - lastTick.current;
        totalMs.current += delta;

        const newSeconds = Math.floor(totalMs.current / 1000);
        setSecondsElapsed((prev) => (newSeconds !== prev ? newSeconds : prev));

        lastTick.current = now;
      }
    }, 100);

    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, [isRecording, isPaused]);

  return (
    <div className="flex flex-row items-center text-xs font-semibold w-15 tabular-nums">
      {isRecording && (
        <div className={cn("flex transition-colors", isPaused && "text-muted")}>
          <NumberRotate>{time.hrs}</NumberRotate>:
          <NumberRotate>{time.mins}</NumberRotate>:{time.secs}
        </div>
      )}

      {!isRecording && "Starting..."}
    </div>
  );
};
