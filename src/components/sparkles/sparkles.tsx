import { LucideIcon } from "lucide-react";
import { motion, MotionProps } from "motion/react";
import { useEffect, useState } from "react";

import { tv } from "../../../tailwind-merge.config";
import { randomInRange, Range } from "../../lib/math";

const sparkleVariants = tv({
  base: "pointer-events-none absolute z-20",
  variants: {
    default: {
      true: "fill-yellow-500 stroke-yellow-500",
    },
  },
});

type Sparkle = {
  delay: number;
  duration: number;
  scale: number;
  x: string;
  y: string;
  color?: string;
};

type GenerateSparkle = {
  duration: Range;
  scale: Range;
  colors?: string[];
  offset?: { x?: Range; y?: Range };
};
const generateSparkle = ({
  colors,
  duration,
  offset,
  scale,
}: GenerateSparkle): Sparkle => {
  const x = randomInRange(offset?.x ?? { max: 100, min: -10 }).toString() + "%";
  const y = randomInRange(offset?.y ?? { max: 75, min: -10 }).toString() + "%";
  return {
    color:
      colors && colors.length > 0
        ? colors[Math.floor(Math.random() * colors.length)]
        : undefined,
    delay: randomInRange({ max: 1.5, min: 0.1 }),
    duration: randomInRange(duration),
    scale: randomInRange(scale),
    x,
    y,
  };
};

type SparkleProps = Required<Omit<SparklesProps, "children" | "sparklesCount">>;
const Sparkle = ({
  colors = [],
  duration,
  fillType,
  icon,
  offset,
  opacity,
  rotate,
  scale,
}: SparkleProps) => {
  const Sparkle = motion.create(icon);
  const [animationProps, setAnimationProps] = useState<MotionProps>();

  useEffect(() => {
    startAnimation();
  }, []);

  const startAnimation = () => {
    const newSparkle = generateSparkle({ colors, duration, offset, scale });

    setAnimationProps((curr) => ({
      ...curr,
      animate: {
        opacity: [0, opacity, 0],
        rotate,
        scale: [0, newSparkle.scale, 0],
      },
      initial: {
        fill: fillType === "stroke-only" ? "transparent" : newSparkle.color,
        left: newSparkle.x,
        stroke: fillType === "fill-only" ? "transparent" : newSparkle.color,
        top: newSparkle.y,
      },
      transition: {
        delay: newSparkle.delay,
        duration: newSparkle.duration,
      },
    }));
  };

  return (
    <Sparkle
      {...animationProps}
      className={sparkleVariants({ default: colors.length === 0 })}
      onAnimationComplete={startAnimation}
    />
  );
};

type SparklesProps = {
  icon: LucideIcon;
  children?: React.ReactNode;
  /**
   * @default undefined
   * @type string[]
   * @description
   * SVG fill compatible colors
   */
  colors?: string[];
  /**
   * @default { min: 0.4, max: 1.2 }
   * @type { min: number, max: number }
   * @description
   * Sparkle animation duration limits
   */
  duration?: Range;
  /**
   * @default "fill-only"
   * @type "stroke-only" | "fill-only" | "fill-and-stroke"
   * @description
   * Icon render type
   */
  fillType?: "stroke-only" | "fill-only" | "fill-and-stroke";
  /**
   * @default { x: { min: -10, max: 100 }, y: { min: -10, max: 75 } }
   * @type { x: { min: number, max: number }, y: { min: number, max: number } }
   * @description
   * Sparkle position range as a percentage, negative values supported
   */
  offset?: { x?: Range; y?: Range };
  /**
   * @default 1
   * @type number
   * @description
   * Maximum opacity | 1 === 100%
   */
  opacity?: number;
  /**
   * @default [-45, 45]
   * @type number[]
   * @description
   * Rotation to move through for each sparkle
   */
  rotate?: number[];
  /**
   * @default { min: 0.3, max: 1.3 }
   * @type { min: number, max: number }
   * @description
   * Sparkle scale limits with 1 = 100%
   */
  scale?: Range;
  sparklesCount?: number;
};

const Sparkles = ({
  children,
  colors,
  duration = { max: 1.2, min: 0.4 },
  fillType = "fill-only",
  icon,
  offset = { x: { max: 100, min: -10 }, y: { max: 75, min: -10 } },
  opacity = 1,
  rotate = [-45, 45],
  scale = { max: 1.3, min: 0.3 },
  sparklesCount = 5,
}: SparklesProps) => {
  return (
    <div>
      <span className="relative inline-block">
        {Array(sparklesCount)
          .fill(0)
          .map((_, i) => (
            <Sparkle
              key={i}
              colors={colors ?? []}
              duration={duration}
              fillType={fillType}
              icon={icon}
              offset={offset}
              opacity={opacity}
              rotate={rotate}
              scale={scale}
            />
          ))}
        {children}
      </span>
    </div>
  );
};

export default Sparkles;
