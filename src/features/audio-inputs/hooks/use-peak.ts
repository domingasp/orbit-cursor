import { useEffect, useRef, useState } from "react";

type UsePeakProps = {
  decibels: number;
};
export const usePeak = ({ decibels }: UsePeakProps) => {
  const [peak, setPeak] = useState(decibels);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    if (decibels > peak) {
      setPeak(decibels);

      clearTimeout(timeoutRef.current ?? undefined);
      timeoutRef.current = setTimeout(() => {
        setPeak(-Infinity);
      }, 3000);
    }
  }, [decibels]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return peak;
};
