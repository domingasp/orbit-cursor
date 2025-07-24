import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AriaToastRegionProps,
  useFocusVisible,
  useFocusWithin,
  useHover,
  useToastRegion,
} from "react-aria";
import { ToastState } from "react-stately";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../tailwind-merge.config";

import { Toast, ToastContent } from "./toast";

const toastRegionVariants = tv({
  defaultVariants: {
    position: "top",
  },
  slots: {
    // Required for central alignment of toasts - without it
    // and with translateX final toast exit moves due to the
    // width reducing to 0
    container: "fixed w-full left-0 flex justify-center z-100",
    region: "flex gap-2 items-center",
  },
  variants: {
    position: {
      // Setting bottom results in items shifting down on exit. A ticket
      // has been raised with motion
      // https://github.com/motiondivision/motion/issues/3324
      bottom: {
        container: "bottom-4",
        region: "flex-col-reverse",
      },
      top: {
        container: "top-4",
        region: "flex-col",
      },
    },
  },
});

const MotionToast = motion.create(Toast);

type ToastRegionProps = AriaToastRegionProps &
  VariantProps<typeof toastRegionVariants> & {
    state: ToastState<ToastContent>;
    className?: string;
  };

export const ToastRegion = ({
  className,
  position = "top",
  state,
  ...props
}: ToastRegionProps) => {
  const isTop = position === "top";
  const { container, region } = toastRegionVariants({ position });

  const ref = useRef(null);
  const { regionProps } = useToastRegion(props, state, ref);

  const [isFocusWithin, setFocusWithin] = useState(false);
  const { focusWithinProps } = useFocusWithin({
    onFocusWithinChange: (isFocusWithin) => {
      setFocusWithin(isFocusWithin);
    },
  });
  const { isFocusVisible } = useFocusVisible();

  // Need to track when front toast was hovered. Region is much larger due to
  // flex container - this way expansion happens only initially when front
  // toast is hovered. Then the region hover works as normal.
  const [frontToastWasHovered, setFrontToastWasHovered] = useState(false);
  const { hoverProps, isHovered } = useHover({
    onHoverEnd: () => {
      setFrontToastWasHovered(false);
    },
  });

  const expanded = useMemo(
    () =>
      (frontToastWasHovered && isHovered) || (isFocusVisible && isFocusWithin),
    [frontToastWasHovered, isHovered, isFocusVisible, isFocusWithin]
  );

  // Track the front toast, other toasts get resized to the same size when
  // collapsed for consistent UI.
  const frontToastRef = useRef<HTMLDivElement>(null);
  const [collapsedSize, setCollapsedSize] = useState<{
    height: number;
    width: number;
  }>({ height: 0, width: 0 });

  useEffect(() => {
    if (expanded) state.pauseAll();
    else state.resumeAll();
  }, [expanded]);

  useLayoutEffect(() => {
    if (!frontToastRef.current) return;
    const { height, width } = frontToastRef.current.getBoundingClientRect();
    setCollapsedSize({ height, width });
  }, [state.visibleToasts]);

  return (
    <div className={container({ className })}>
      <div
        {...regionProps}
        {...hoverProps}
        {...focusWithinProps}
        ref={ref}
        className={region()}
      >
        <AnimatePresence mode="popLayout">
          {state.visibleToasts.map((toast, index) => {
            const isFront = index === 0;

            const scale = expanded ? 1 : 1 - 0.05 * index;
            const y = expanded
              ? 0
              : (isTop ? -index : index) * collapsedSize.height;

            const height =
              expanded || isFront ? undefined : collapsedSize.height;
            const width = expanded || isFront ? undefined : collapsedSize.width;

            return (
              <MotionToast
                key={toast.key}
                exit={{ opacity: 0, scale: 0.6 }}
                expanded={expanded}
                forwardedRef={isFront ? frontToastRef : undefined}
                state={state}
                toast={toast}
                animate={{
                  height,
                  opacity: 1,
                  scale,
                  width,
                  y,
                  zIndex: 10 - index,
                }}
                initial={{
                  height,
                  opacity: 0,
                  width,
                  y: isTop ? -50 : 50,
                }}
                onHoverStart={() => {
                  setFrontToastWasHovered(true);
                }}
                transition={{
                  width: { duration: 0.15 },
                  y: { duration: 0.6, type: "spring" },
                }}
                layout
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
