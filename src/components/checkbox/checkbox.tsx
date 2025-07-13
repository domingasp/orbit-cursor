import { motion } from "motion/react";
import {
  Checkbox as AriaCheckbox,
  CheckboxProps as AriaCheckboxProps,
} from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../tailwind-merge.config";

const checkboxVariants = tv({
  slots: {
    base: "group flex items-center relative gap-2 text-content-fg text-sm",
    checkbox: [
      "w-5 h-5 border-1 border-muted/50 rounded-sm transition-colors",
      "flex items-center justify-center shrink-0",
      "group-data-[selected]:border-info group-data-[selected]:bg-info",
    ],
    svg: "w-3.5 h-3.5 fill-none translate-y-[0.5px]",
  },
});

type CheckboxProps = AriaCheckboxProps &
  Omit<AriaCheckboxProps, "children"> &
  VariantProps<typeof checkboxVariants> & { children?: React.ReactNode };

const Checkbox = ({ children, ...props }: CheckboxProps) => {
  const { base, checkbox, svg } = checkboxVariants();

  return (
    <AriaCheckbox {...props} className={base()}>
      {({ isSelected }) => (
        <>
          <div className={checkbox()}>
            <svg aria-hidden="true" className={svg()} viewBox="3 4 12 10">
              <motion.path
                d="M4 9 L7 12 L14 5"
                initial={false}
                stroke="white"
                strokeLinecap="round"
                strokeWidth="2"
                animate={{
                  opacity: isSelected ? 1 : 0,
                  pathLength: isSelected ? 1 : 0,
                }}
                transition={{
                  duration: 0.2,
                  // Necessary as linecap round would leave a circle even when
                  // pathLength 0
                  opacity: {
                    delay: isSelected ? 0 : 0.15,
                    duration: 0.05,
                    ease: "easeInOut",
                  },
                }}
              />
            </svg>
          </div>
          {children}
        </>
      )}
    </AriaCheckbox>
  );
};

export default Checkbox;
