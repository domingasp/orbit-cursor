import { AnimatePresence, motion, MotionProps } from "motion/react";
import { ReactNode, useEffect, useState } from "react";

type ContentRotateProps = MotionProps & {
  children: ReactNode;
  contentKey: string;
  className?: string;
};
const ContentRotate = ({
  children,
  className,
  contentKey,
  ...props
}: ContentRotateProps) => {
  const [isFirstMount, setIsFirstMount] = useState(true);

  useEffect(() => {
    setIsFirstMount(false);
  }, []);

  return (
    <div className="overflow-hidden">
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

export default ContentRotate;
