import { OverlayScrollbarsComponent } from "overlayscrollbars-react";

import { cn } from "../../../lib/styling";

type SelectorWrapperProps = {
  children?: React.ReactNode;
  className?: string;
};

export const SelectorWrapper = ({
  children,
  className,
}: SelectorWrapperProps) => {
  return (
    <OverlayScrollbarsComponent
      className={cn(
        "w-full h-full inset-shadow-full rounded-md relative overflow-hidden",
        className
      )}
      options={{
        scrollbars: { autoHide: "scroll", theme: "os-theme-orbit-cursor" },
      }}
      defer
    >
      <div className="flex items-center-safe justify-center-safe w-full h-full">
        {children}
      </div>
    </OverlayScrollbarsComponent>
  );
};
