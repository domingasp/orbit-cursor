import { motion } from "motion/react";
import { AriaProgressBarProps } from "react-aria";
import { ProgressBar as AriaProgressBar } from "react-aria-components";

import { tv } from "../../../tailwind-merge.config";

const ANIMATION_DURATION = 1.25;

const circularProgressBarVariants = tv({
  slots: {
    backdrop: "stroke-muted/15",
    base: "relative size-40",
    label:
      "absolute inset-0 text-content-fg text-3xl font-bold flex items-center justify-center",
    progress: "stroke-info [stroke-linecap:round]",
  },
});

type CircularProgressBarProps = AriaProgressBarProps & {
  hideBackdrop?: boolean;
  indeterminate?: boolean;
  renderLabel?: (value?: number) => React.ReactNode;
  size?: number;
  strokeWidth?: number;
};

export const CircularProgressBar = ({
  hideBackdrop = false,
  indeterminate = false,
  renderLabel,
  size = 100,
  strokeWidth = 10,
  ...props
}: CircularProgressBarProps) => {
  const { backdrop, base, label, progress } = circularProgressBarVariants();

  const radius = 50 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <AriaProgressBar
      className={base()}
      style={{ height: size, width: size }}
      {...props}
    >
      {({ percentage }) => (
        <>
          <svg
            className="fill-none size-full"
            strokeWidth={strokeWidth}
            viewBox="0 0 100 100"
          >
            {!hideBackdrop && (
              <circle className={backdrop()} cx="50" cy="50" r={radius} />
            )}

            {indeterminate && (
              <motion.circle
                className={progress()}
                cx="50"
                cy="50"
                r={radius}
                rotate={-90}
                strokeWidth={strokeWidth}
                animate={{
                  rotate: [0, 180, 360],
                  strokeDasharray: [
                    `${(
                      circumference * 0.1
                    ).toString()} ${circumference.toString()}`,
                    `${(
                      circumference * 0.25
                    ).toString()} ${circumference.toString()}`,
                    `${(
                      circumference * 0.1
                    ).toString()} ${circumference.toString()}`,
                  ],
                  strokeDashoffset: [
                    circumference * 0.45,
                    circumference * 0.45 + circumference * 0.22,
                    circumference * 0.45,
                  ],
                }}
                transition={{
                  rotate: {
                    duration: ANIMATION_DURATION,
                    ease: "linear",
                    repeat: Infinity,
                  },
                  strokeDasharray: {
                    duration: ANIMATION_DURATION,
                    ease: "easeInOut",
                    repeat: Infinity,
                  },
                  strokeDashoffset: {
                    duration: ANIMATION_DURATION,
                    ease: "easeInOut",
                    repeat: Infinity,
                  },
                }}
              />
            )}

            {percentage && !indeterminate && (
              <motion.circle
                className={progress()}
                cx="50"
                cy="50"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={circumference}
                strokeWidth={strokeWidth}
                transform="rotate(-90 50 50)"
                transition={{ duration: 0.5, ease: "easeInOut" }}
                animate={{
                  strokeDashoffset: circumference * (1 - percentage / 100),
                }}
              />
            )}
          </svg>

          {renderLabel?.(percentage) ??
            (percentage !== undefined && !indeterminate && (
              <span className={label()}>{percentage.toFixed(0)}</span>
            ))}
        </>
      )}
    </AriaProgressBar>
  );
};
