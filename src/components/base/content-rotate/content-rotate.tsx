import { AnimatePresence, motion, MotionProps } from "motion/react";
import { ReactNode, useEffect, useState } from "react";

import { cn } from "../../../lib/styling";

type ContentRotateProps = MotionProps & {
  children: ReactNode;
  contentKey: string;
  className?: string;
  containerClassName?: string;
};
export const ContentRotate = ({
  children,
  className,
  containerClassName,
  contentKey,
  ...props
}: ContentRotateProps) => {
  const [isFirstMount, setIsFirstMount] = useState(true);

  useEffect(() => {
    setIsFirstMount(false);
  }, []);

  return (
    <div className={cn("overflow-hidden", containerClassName)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={contentKey}
          animate={{ opacity: 1, y: 0 }}
          className={className}
          exit={{ opacity: 0, y: 25 }}
          initial={isFirstMount ? false : { opacity: 0, y: -25 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          {...props}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
