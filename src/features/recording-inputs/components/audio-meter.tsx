import { SVGAttributes, useEffect, useRef, useState } from "react";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";

const decibelToPercentage = (decibel: number): number => {
  if (decibel < -60) return 0;
  if (decibel > 0) return 100;

  const normalized = (decibel + 60) / 60;
  const power = 1.357; // -24 dB map to ~50%
  return Math.pow(normalized, power) * 100;
};

const tickVariants = tv({
  defaultVariants: {
    position: "below",
  },
  slots: {
    base: "absolute flex flex-col -translate-x-[50%] text-muted items-center pointer-events-none select-none",
    label: "relative text-[6px]/2 text-shadow-2xs transition-colors px-0.25",
    line: "w-[1px] h-[2px] bg-muted transition-colors",
  },
  variants: {
    clipping: {
      true: {
        label: "text-warning-100",
        line: "bg-warning-100",
      },
    },
    position: {
      above: { base: "flex-col-reverse", label: "mb-[1px]" },
      below: { base: "flex-col mt-[1.5px]" },
    },
  },
});

type TickProps = VariantProps<typeof tickVariants> & {
  tick: number;
  display?: string;
  excludeLine?: boolean;
  labelClassName?: string;
  maxTick?: number;
};
const Tick = ({
  display,
  excludeLine = false,
  labelClassName,
  maxTick,
  position,
  tick,
}: TickProps) => {
  const { base, label, line } = tickVariants({ clipping: tick > 0, position });
  return (
    <div
      key={tick}
      className={base()}
      style={{
        left:
          decibelToPercentage(Math.min(maxTick ?? Infinity, tick)).toString() +
          "%",
      }}
    >
      {!excludeLine && <div className={line()} />}
      <span className={label({ className: labelClassName })}>
        {display ?? tick}
      </span>
    </div>
  );
};

type AudioMeterProps = {
  decibels: number;
  disabled?: boolean;
  height?: number;
  hidePeakTick?: boolean;
  hideTicks?: boolean;
  peak?: number;
  radius?: number;
  width?: number | string;
};

const AudioMeter = ({
  decibels,
  disabled,
  height = 10,
  hidePeakTick,
  hideTicks,
  peak = -Infinity,
  radius = 2,
  width = 150,
}: AudioMeterProps) => {
  const percentage = decibelToPercentage(decibels);
  const peakPercentage = decibelToPercentage(Math.min(peak, -0.5));

  const svg = useRef<SVGSVGElement>(null);
  const [ticks, setTicks] = useState([-48, -24]);

  const METER: SVGAttributes<SVGRectElement> = {
    height: "100%",
    rx: radius,
    ry: radius,
    width: disabled ? "0%" : "100%",
  };

  useEffect(() => {
    const latestTicks = [-48, -24];
    if (svg.current) {
      if (svg.current.clientWidth > 70) latestTicks.push(-12);
      if (svg.current.clientWidth > 5) latestTicks.push(-3);
    }
    setTicks(latestTicks);
  }, [width]);

  return (
    <div className="pointer-events-none select-none">
      {/* Using SVG due to layering divs with border-radius and linear gradient
       * causing bleeding */}
      <svg
        ref={svg}
        height={height}
        viewBox={`0 0 ${width.toString()} ${height.toString()}`}
        width={width}
      >
        <defs>
          <linearGradient id="meterFill" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="var(--color-success)" />
            <stop offset="65%" stopColor="var(--color-success)" />
            <stop offset="85%" stopColor="var(--color-warning)" />
            <stop offset="93%" stopColor="var(--color-warning)" />
            <stop offset="96%" stopColor="var(--color-warning-100)" />
            <stop offset="100%" stopColor="var(--color-warning-100)" />{" "}
          </linearGradient>

          <clipPath id="meterClip">
            <rect height="100%" width={percentage.toString() + "%"} />
          </clipPath>

          <clipPath id="peakClip">
            <rect
              height="100%"
              transform="translate(-1,0)"
              width="2px"
              x={peakPercentage.toString() + "%"}
            />
          </clipPath>
        </defs>

        <rect className="fill-muted/20" {...METER} width="100%" />
        <rect clipPath="url(#meterClip)" fill="url(#meterFill)" {...METER} />
        <rect clipPath="url(#peakClip)" fill="url(#meterFill)" {...METER} />
      </svg>

      {(!hideTicks || !hidePeakTick) && (
        <div className="relative h-3">
          {!hideTicks &&
            [...ticks].map((tick) => <Tick key={tick} tick={tick} />)}

          {!hidePeakTick && !disabled && peak >= -60 && (
            <Tick
              display={peak.toFixed(1)}
              labelClassName="backdrop-blur-xs bg-content/50"
              maxTick={-0.5}
              position="below"
              tick={peak}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default AudioMeter;
