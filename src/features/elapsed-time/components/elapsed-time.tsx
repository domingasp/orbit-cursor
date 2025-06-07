import { useEffect, useMemo, useState } from "react";

import NumberRotate from "./number-rotate";

const ElapsedTime = () => {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const formatTime = (seconds: number) => {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");

    return { hrs, mins, secs };
  };

  const time = useMemo(() => formatTime(secondsElapsed), [secondsElapsed]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-row items-center text-xs font-semibold w-14 tabular-nums">
      <NumberRotate>{time.hrs}</NumberRotate>:
      <NumberRotate>{time.mins}</NumberRotate>:{time.secs}
    </div>
  );
};

export default ElapsedTime;
