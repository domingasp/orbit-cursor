import {
  Popover as AriaPopover,
  PopoverProps as AriaPopoverProps,
  Dialog,
  OverlayArrow,
} from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";
import { cn } from "../../../lib/styling";

const popoverVariants = tv({
  base: "bg-content rounded-md text-content-fg border-1 border-muted/10 bg-popover shadow-lg",
});

type PopoverProps = AriaPopoverProps &
  VariantProps<typeof popoverVariants> & {
    children: React.ReactNode;
    className?: string;
  };

export const Popover = ({
  children,
  className,
  placement = "bottom",
  ...props
}: PopoverProps) => {
  return (
    <AriaPopover {...props} className={popoverVariants()} placement={placement}>
      <OverlayArrow>
        <svg
          height={12}
          viewBox="0 0 12 12"
          width={12}
          className={cn(
            "fill-content stroke-1 stroke-muted/10",
            (placement.startsWith("left") || placement.startsWith("start")) &&
              "rotate-270",
            (placement.startsWith("right") || placement.startsWith("end")) &&
              "rotate-90",
            placement.startsWith("bottom") && "rotate-180"
          )}
        >
          <path d="M0 0 L6 6 L12 0" />
        </svg>
      </OverlayArrow>

      <Dialog className={cn("bg-content rounded-md", className)}>
        {children}
      </Dialog>
    </AriaPopover>
  );
};
