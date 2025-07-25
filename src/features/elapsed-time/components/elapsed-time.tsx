import { useEffect, useMemo, useRef, useState } from "react";

import { formatTime } from "../../../lib/time";

import { NumberRotate } from "./number-rotate";

type ElapsedTimeProps = {
  isRecording: boolean;
};

export const ElapsedTime = ({ isRecording }: ElapsedTimeProps) => {
  const interval = useRef<NodeJS.Timeout>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const time = useMemo(() => formatTime(secondsElapsed), [secondsElapsed]);

  useEffect(() => {
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, []);

  useEffect(() => {
    setSecondsElapsed(0);

    if (!isRecording) {
      if (interval.current) clearInterval(interval.current);
      interval.current = null;
    } else if (!interval.current) {
      interval.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
  }, [isRecording]);

  return (
    <div className="flex flex-row items-center text-xs font-semibold w-15 tabular-nums">
      {isRecording && (
        <>
          <NumberRotate>{time.hrs}</NumberRotate>:
          <NumberRotate>{time.mins}</NumberRotate>:{time.secs}
        </>
      )}

      {!isRecording && "Starting..."}
    </div>
  );
};
