import { X } from "lucide-react";
import {
  Ref,
  RefObject,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import React from "react";
import { AriaToastProps, useFocusRing, useToast } from "react-aria";
import { ToastState } from "react-stately";

import { tv } from "../../../tailwind-merge.config";
import { elementFocus, focusStyles } from "../../lib/styling";
import { Button } from "../button/button";

const toastVariants = tv({
  slots: {
    base: [
      "bg-content text-content-fg rounded-md p-2 outline-none border-1 border-neutral shadow-md",
      "flex grow gap-6 items-center transition-shadow max-w-85",
      elementFocus,
      focusStyles,
    ],
    closeButton: "p-0.5 self-stretch",
    content: "flex flex-col grow transition-opacity duration 350",
    contentWrapper: "flex items-center gap-2 grow",
    description: "text-muted text-xs font-light",
    title: "font-bold text-xs whitespace-nowrap",
  },
  variants: {
    behind: {
      true: {
        closeButton: "invisible opacity-0",
        contentWrapper: "opacity-0",
      },
    },
  },
});

export type ToastContent = {
  title: string;
  description?: string;
  leftSection?: React.ReactNode;
};

type ToastProps = AriaToastProps<ToastContent> & {
  expanded: boolean;
  state: ToastState<ToastContent>;
  forwardedRef?: RefObject<HTMLDivElement | null>;
  ref?: Ref<HTMLDivElement>;
};

export const Toast = ({
  expanded,
  forwardedRef,
  ref: outerRef,
  state,
  ...props
}: ToastProps) => {
  const behind = forwardedRef === undefined && !expanded;
  const { base, closeButton, content, contentWrapper, description, title } =
    toastVariants({
      behind,
    });

  const ref = useRef<HTMLDivElement>(null);
  const {
    closeButtonProps,
    contentProps,
    descriptionProps,
    titleProps,
    toastProps,
  } = useToast(props, state, ref);

  const { focusProps, isFocusVisible } = useFocusRing();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  useImperativeHandle(outerRef, () => ref.current!, []);

  const [width, setWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.getBoundingClientRect().width);
  }, [ref]);

  return (
    <div
      {...toastProps}
      {...focusProps}
      {...(isFocusVisible ? { "data-focus-visible": "" } : {})}
      ref={(el) => {
        ref.current = el;
        if (forwardedRef) forwardedRef.current = el;
      }}
      className={base()}
      style={{
        // When element is popped the width is rounded to nearest number
        // Something like 327.33 would become 327 - this can cause layout
        // shifts which only appear in the exit animations
        minWidth:
          (expanded || forwardedRef !== undefined) &&
          ref.current?.hasAttribute("data-motion-pop-id")
            ? width
            : // If closing all it should keep the animated width UNLESS it is
              // the top toast
              undefined,
      }}
    >
      <div {...contentProps} className={contentWrapper()}>
        {props.toast.content.leftSection && (
          <div>{props.toast.content.leftSection}</div>
        )}

        <div className={content()}>
          <span {...titleProps} className={title()} slot="title">
            {props.toast.content.title}
          </span>
          <span
            {...descriptionProps}
            className={description()}
            slot="description"
          >
            {props.toast.content.description}
          </span>
        </div>
      </div>
      <Button
        {...closeButtonProps}
        className={closeButton()}
        size="sm"
        slot="close"
        variant="ghost"
      >
        <X className="translate-x-0" size={16} />
      </Button>
    </div>
  );
};
