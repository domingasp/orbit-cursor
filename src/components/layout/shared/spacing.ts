import { tv } from "../../../../tailwind-merge.config";

export const spacing = tv({
  variants: {
    spacing: {
      lg: "gap-lg",
      md: "gap-md",
      sm: "gap-sm",
      xs: "gap-xs",
    },
  },
});
