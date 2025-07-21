import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import {
  AriaToastRegionProps,
  useFocusVisible,
  useFocusWithin,
  useHover,
  useToastRegion,
} from "react-aria";
import { ToastState } from "react-stately";

import { tv } from "../../../tailwind-merge.config";

import Toast, { ToastContent } from "./toast";

const toastRegionVariants = tv({
  base: ["fixed bottom-4 right-4 flex flex-col-reverse gap-2"],
});

const MotionToast = motion.create(Toast);

type ToastRegionProps = AriaToastRegionProps & {
  state: ToastState<ToastContent>;
};

const ToastRegion = ({ state, ...props }: ToastRegionProps) => {
  const ref = useRef(null);
  const { regionProps } = useToastRegion(props, state, ref);

  const peekStep = 50;

  const [isFocusWithin, setFocusWithin] = useState(false);
  const { focusWithinProps } = useFocusWithin({
    onFocusWithinChange: (isFocusWithin) => {
      setFocusWithin(isFocusWithin);
    },
  });
  const { isFocusVisible } = useFocusVisible();

  const { hoverProps, isHovered } = useHover({});

  const expanded = isHovered || (isFocusVisible && isFocusWithin);

  return (
    <div
      {...regionProps}
      {...hoverProps}
      {...focusWithinProps}
      ref={ref}
      className={toastRegionVariants()}
      style={{ height: expanded ? "auto" : peekStep }}
    >
      <AnimatePresence mode="popLayout">
        {state.visibleToasts.map((toast, index) => {
          const scale = expanded ? 1 : 1 - 0.05 * index;
          const y = expanded ? 0 : index * peekStep;

          return (
            <MotionToast
              key={toast.key}
              animate={{ opacity: 1, scale, y, zIndex: 10 - index }}
              exit={{ opacity: 0, scale: 0.6 }}
              initial={{ opacity: 0, y: 50 }}
              state={state}
              toast={toast}
              transition={{ duration: 0.6, type: "spring" }}
              layout
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ToastRegion;
