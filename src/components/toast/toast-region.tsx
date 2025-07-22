import { AnimatePresence, motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
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

import Toast, { ToastContent } from "./toast";

const toastRegionVariants = tv({
  base: "fixed flex gap-2 left-[50%] -translate-x-[50%] items-center",
  defaultVariants: {
    position: "top",
  },
  variants: {
    position: {
      // Setting bottom results in items shifting down on exit. A ticket
      // has been raised with motion
      // https://github.com/motiondivision/motion/issues/3324
      bottom: "flex-col-reverse bottom-4",
      top: "flex-col top-4",
    },
  },
});

const MotionToast = motion(Toast);

type ToastRegionProps = AriaToastRegionProps &
  VariantProps<typeof toastRegionVariants> & {
    state: ToastState<ToastContent>;
  };

const ToastRegion = ({ position, state, ...props }: ToastRegionProps) => {
  const isTop = position === "top";

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

  const expanded =
    (frontToastWasHovered && isHovered) || (isFocusVisible && isFocusWithin);

  // Track the front toast, other toasts get resized to the same size when
  // collapsed for consistent UI.
  const frontToastRef = useRef<HTMLDivElement>(null);
  const [collapsedSize, setCollapsedSize] = useState<{
    height: number;
    width: number;
  }>({ height: 0, width: 0 });

  useLayoutEffect(() => {
    if (!frontToastRef.current) return;
    const { height, width } = frontToastRef.current.getBoundingClientRect();
    setCollapsedSize({ height, width });
  }, [state.visibleToasts]);

  return (
    <div
      {...regionProps}
      {...hoverProps}
      {...focusWithinProps}
      ref={ref}
      className={toastRegionVariants({ position })}
    >
      <AnimatePresence mode="popLayout">
        {state.visibleToasts.map((toast, index) => {
          const isFront = index === 0;

          const scale = expanded ? 1 : 1 - 0.05 * index;
          const y = expanded
            ? 0
            : (isTop ? -index : index) * collapsedSize.height;

          const height = expanded || isFront ? undefined : collapsedSize.height;
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
                width: { duration: 0.2 },
                y: { duration: 0.6, type: "spring" },
              }}
              layout
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ToastRegion;
