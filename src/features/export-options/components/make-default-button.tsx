import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { ComponentProps, useState } from "react";
import { PressEvent } from "react-aria";

import { Button } from "../../../components/button/button";
import { cn } from "../../../lib/styling";

type MakeDefaultButtonProps = ComponentProps<typeof Button>;

// TODO when required in another place lift this into components
// One-shot action button

/** Shows a check after pressing, has no concept of success/fail. */
export const MakeDefaultButton = ({
  children,
  className,
  onPress,
  ...props
}: MakeDefaultButtonProps) => {
  const [isClicked, setIsClicked] = useState(false);

  const handlePress = (e: PressEvent) => {
    onPress?.(e);

    setIsClicked(true);
    setTimeout(() => {
      setIsClicked(false);
    }, 2000);
  };
  return (
    <Button
      {...props}
      className={cn(className, "relative")}
      isDisabled={isClicked}
      onPress={handlePress}
    >
      {children}

      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-all",
          isClicked ? "backdrop-blur-md" : "backdrop-blur-none"
        )}
      >
        <AnimatePresence>
          {isClicked && (
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              initial={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.2 }}
            >
              <Check className="text-success" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </Button>
  );
};
