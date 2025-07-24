import { useEffect, useRef } from "react";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../tailwind-merge.config";

const overflowShadowVariants = tv({
  compoundSlots: [
    {
      class: "absolute z-100 rounded-xs from-content-fg/25 to-transparent",
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
  defaultVariants: {
    orientation: "vertical",
  },
  slots: {
    content: "overflow-scroll h-full p-2 overscroll-none",
    end: "",
    start: "",
  },
  variants: {
    noScrollbar: {
      true: {
        content: "scrollbar-hidden",
      },
    },
    orientation: {
      horizontal: {
        content: "text-nowrap",
        end: "right-0 bg-gradient-to-l",
        start: "left-0 bg-gradient-to-r",
      },
      vertical: {
        end: "bottom-0 bg-gradient-to-t",
        start: "top-0 bg-gradient-to-b",
      },
    },
  },
});

type OverflowShadowProps = VariantProps<typeof overflowShadowVariants> & {
  children?: React.ReactNode;
  className?: string;
  startAtEnd?: boolean;
};

export const OverflowShadow = ({
  children,
  className,
  noScrollbar,
  orientation,
  startAtEnd,
}: OverflowShadowProps) => {
  const { content, end, start } = overflowShadowVariants({
    noScrollbar,
    orientation,
  });
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const updateShadows = () => {
    if (!contentRef.current || !startRef.current || !endRef.current) return;

    const {
      clientHeight,
      clientWidth,
      scrollHeight,
      scrollLeft,
      scrollTop,
      scrollWidth,
    } = contentRef.current;

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

  useEffect(() => {
    if (!contentRef.current) return;

    contentRef.current.addEventListener("scroll", updateShadows);
    window.addEventListener("resize", updateShadows);

    if (startAtEnd) {
      if (orientation === "vertical") {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      } else {
        contentRef.current.scrollLeft = contentRef.current.scrollWidth;
      }
    }

    updateShadows(); // Initial call to set opacity

    return () => {
      contentRef.current?.removeEventListener("scroll", updateShadows);
      window.removeEventListener("resize", updateShadows);
    };
  }, [orientation, children]);

  return (
    <>
      <div ref={startRef} className={start()} style={{ opacity: "0" }} />
      <div ref={endRef} className={end()} style={{ opacity: "1" }} />

      <div ref={contentRef} className={content({ className })}>
        {children}
      </div>
    </>
  );
};
