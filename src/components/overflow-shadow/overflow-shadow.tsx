import { useEffect, useRef, useState } from "react";
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
    content: "overflow-scroll h-full p-2",
    end: "",
    start: "",
  },
  variants: {
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
  },
});

type OverflowShadowProps = VariantProps<typeof overflowShadowVariants> & {
  children?: React.ReactNode;
};
const OverflowShadow = ({ children, orientation }: OverflowShadowProps) => {
  const { content, end, start } = overflowShadowVariants({ orientation });
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [scrollTotal, setScrollTotal] = useState(0);

  const onScroll = () => {
    if (!contentRef.current || !startRef.current || !endRef.current) return;

    const { scrollLeft, scrollTop } = contentRef.current;
    const scrollAmount =
      (orientation === "vertical" ? scrollTop : scrollLeft) / scrollTotal;

    startRef.current.style.opacity = scrollAmount.toString();
    endRef.current.style.opacity = (1 - scrollAmount).toString();
  };

  useEffect(() => {
    if (contentRef.current && contentRef.current.parentElement) {
      const { parentElement, scrollHeight, scrollWidth } = contentRef.current;
      setScrollTotal(
        (orientation === "vertical" ? scrollHeight : scrollWidth) -
          parentElement.offsetWidth
      );
    }
  }, [orientation]);

  useEffect(() => {
    if (scrollTotal > 0) {
      contentRef.current?.addEventListener("scroll", onScroll);
    }

    return () => {
      contentRef.current?.removeEventListener("scroll", onScroll);
    };
  }, [scrollTotal]);

  return (
    <>
      <div ref={startRef} className={start()} style={{ opacity: "0" }} />
      <div ref={endRef} className={end()} style={{ opacity: "1" }} />
      <div ref={contentRef} className={content()}>
        {children}
      </div>
    </>
  );
};

export default OverflowShadow;
