import { VolumeOffIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { ReactNode } from "react";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";

const decibelToPercentage = (decibels: number) => {
  if (decibels <= -99) return 0;
  if (decibels <= -30) return ((decibels + 99) / 69) * 20;
  if (decibels <= -10) return 20 + ((decibels + 30) / 20) * 55;
  if (decibels <= 0) return 75 + ((decibels + 10) / 10) * 25;
  return 100;
};

const decibelsToLabel = (decibels: number) => {
  if (decibels > 0) return "0";
  if (decibels < -99) return "-∞";
  return decibels.toFixed(1);
};

const decibelsToColor = (decibels: number) => {
  if (decibels < -99) return "var(--color-muted)";
  if (decibels < -20) return "var(--color-success)";
  if (decibels < -8) return "var(--color-warning)";
  return "var(--color-error)";
};

const audioMeterVariants = tv({
  defaultVariants: {
    orientation: "vertical",
  },
  slots: {
    base: "flex items-center",
    disabledIconContainer:
      "text-muted absolute inset-0 flex items-center justify-center p-1",
    label: "text-xxs font-semibold",
    meter: "bg-content-fg rounded-sm transition-all",
    meterContainer:
      "flex items-end bg-neutral rounded-sm overflow-hidden relative",
  },
  variants: {
    disabled: {
      true: {
        disabledIconContainer: "text-muted",
        label: "text-muted",
      },
    },
    orientation: {
      horizontal: {
        base: "flex-row-reverse gap-2 w-full",
        label: "w-[35px] text-center",
      },
      vertical: {
        base: "flex-col gap-0.5",
      },
    },
  },
});

type AudioMeterProps = VariantProps<typeof audioMeterVariants> & {
  decibels: number;
  disabledIcon?: ReactNode;
  height?: number | string;
  width?: number | string;
};

const AudioMeter = ({
  decibels: decibelsValue,
  disabled = false,
  disabledIcon = <VolumeOffIcon size={20} />,
  height = 40,
  orientation = "vertical",
  width = 40,
}: AudioMeterProps) => {
  const { base, disabledIconContainer, label, meter, meterContainer } =
    audioMeterVariants({
      disabled,
      orientation,
    });

  const decibels = disabled ? -Infinity : decibelsValue;

  const color = decibelsToColor(decibels);
  const fillPercentage = decibelToPercentage(decibels).toString() + "%";

  return (
    <div className={base()}>
      <div className={meterContainer()} style={{ height, width }}>
        <div
          className={meter()}
          style={{
            background: color,
            height: orientation === "vertical" ? fillPercentage : "100%",
            width: orientation === "horizontal" ? fillPercentage : "100%",
          }}
        />

        <AnimatePresence>
          {disabled && (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className={disabledIconContainer()}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0, scale: 0 }}
            >
              {disabledIcon}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <span
        className={label()}
        style={{
          color: !disabled ? color : undefined,
        }}
      >
        {decibelsToLabel(decibels)}
      </span>
    </div>
  );
};

export default AudioMeter;
