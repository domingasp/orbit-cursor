import {
  OverlayScrollbarsComponent,
  OverlayScrollbarsComponentRef,
} from "overlayscrollbars-react";
import { useEffect, useRef } from "react";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";
import { availableVariants, cn } from "../../../lib/styling";

const overflowShadowVariants = tv({
  compoundSlots: [
    {
      class: "absolute z-100 from-content-fg/25 to-transparent",
      slots: ["end", "start"],
    },
    {
      class: "w-full h-[10px]",
      orientation: "vertical",
      slots: ["end", "start"],
    },
    {
      class: "w-[10px] h-full",
      orientation: "horizontal",
      slots: ["end", "start"],
    },
  ],
  compoundVariants: [
    {
      class: {
        end: "rounded-r-md",
        start: "rounded-l-md",
      },
      orientation: "horizontal",
      shadowRadius: "md",
    },
    {
      class: {
        end: "rounded-r-sm",
        start: "rounded-l-sm",
      },
      orientation: "horizontal",
      shadowRadius: "sm",
    },
    {
      class: {
        end: "rounded-b-md",
        start: "rounded-t-md",
      },
      orientation: "vertical",
      shadowRadius: "md",
    },
    {
      class: {
        end: "rounded-b-sm",
        start: "rounded-t-sm",
      },
      orientation: "vertical",
      shadowRadius: "sm",
    },
  ],
  defaultVariants: {
    orientation: "vertical",
    shadowRadius: "sm",
  },
  slots: {
    end: "pointer-events-none",
    os: "w-full h-full relative overflow-hidden",
    start: "pointer-events-none",
  },
  variants: {
    insetShadow: {
      true: {
        os: "inset-shadow-full",
      },
    },
    orientation: {
      horizontal: {
        end: "right-0 bg-gradient-to-l",
        start: "left-0 bg-gradient-to-r",
      },
      vertical: {
        end: "bottom-0 bg-gradient-to-t",
        start: "top-0 bg-gradient-to-b",
      },
    },
    shadowRadius: {
      md: {
        os: "rounded-md",
      },
      sm: {
        os: "rounded-sm",
      },
    },
  },
});

type OverflowShadowProps = VariantProps<typeof overflowShadowVariants> & {
  children?: React.ReactNode;
  className?: string;
  hideScrollbar?: boolean;
  startAtEnd?: boolean;
};

export const OverflowShadow = ({
  children,
  className,
  hideScrollbar,
  insetShadow,
  orientation,
  shadowRadius,
  startAtEnd,
}: OverflowShadowProps) => {
  const { end, os, start } = overflowShadowVariants({
    insetShadow,
    orientation,
    shadowRadius,
  });

  const osRef = useRef<OverlayScrollbarsComponentRef>(null);
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollElRef = useRef<HTMLElement | null>(null);

  const updateShadows = () => {
    const scrollEl = scrollElRef.current;
    if (!scrollEl || !startRef.current || !endRef.current) return;

    const {
      clientHeight,
      clientWidth,
      scrollHeight,
      scrollLeft,
      scrollTop,
      scrollWidth,
    } = scrollEl;

    const scrollPosition = orientation === "vertical" ? scrollTop : scrollLeft;
    const scrollSize = orientation === "vertical" ? scrollHeight : scrollWidth;
    const clientSize = orientation === "vertical" ? clientHeight : clientWidth;

    const maxScroll = scrollSize - clientSize;

    const hasOverflow = scrollSize > clientSize;
    if (hasOverflow) {
      const scrollAmount = scrollPosition / maxScroll;
      startRef.current.style.opacity = scrollAmount.toString();
      endRef.current.style.opacity = (1 - scrollAmount).toString();
    } else {
      startRef.current.style.opacity = "0";
      endRef.current.style.opacity = "0";
    }
  };

  const createShadowNode = (startShadow: boolean) => {
    const shadow = document.createElement("div");
    shadow.className = startShadow ? start() : end();
    shadow.style.opacity = startShadow ? "0" : "1";
    return shadow;
  };

  // Must manually append to scroll parent, OverlayScrollbars children
  // go inside internal viewport
  const initializeShadows = (scrollEl: HTMLElement) => {
    if (!startRef.current) {
      startRef.current = createShadowNode(true);
      scrollEl.parentElement?.appendChild(startRef.current);
    }

    if (!endRef.current) {
      endRef.current = createShadowNode(false);
      scrollEl.parentElement?.appendChild(endRef.current);
    }
  };

  const handleInitialized = () => {
    const scrollEl = osRef.current?.osInstance()?.elements().viewport;
    if (!scrollEl) return;

    scrollElRef.current = scrollEl;

    scrollEl.addEventListener("scroll", updateShadows);
    window.addEventListener("resize", updateShadows);

    if (startAtEnd) {
      if (orientation === "vertical") {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      } else {
        scrollEl.scrollLeft = scrollEl.scrollWidth;
      }
    }

    initializeShadows(scrollEl);
    updateShadows();
  };

  useEffect(() => {
    return () => {
      const scrollEl = scrollElRef.current;
      if (scrollEl) {
        scrollEl.removeEventListener("scroll", updateShadows);
        window.removeEventListener("resize", updateShadows);
      }
    };
  }, []);

  return (
    <OverlayScrollbarsComponent
      ref={osRef}
      className={os()}
      events={{
        updated: handleInitialized,
      }}
      options={{
        overflow: {
          x: orientation === "horizontal" ? "scroll" : "hidden",
          y: orientation === "vertical" ? "scroll" : "hidden",
        },
        scrollbars: {
          autoHide: "scroll",
          theme: "os-theme-orbit-cursor",
          visibility: hideScrollbar ? "hidden" : "visible",
        },
      }}
      defer
    >
      <div
        className={cn(orientation === "horizontal" && "text-nowrap", className)}
      >
        {children}
      </div>
    </OverlayScrollbarsComponent>
  );
};
