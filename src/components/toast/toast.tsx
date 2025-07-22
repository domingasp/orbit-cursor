import { X } from "lucide-react";
import { Ref, RefObject, useImperativeHandle, useRef } from "react";
import React from "react";
import { AriaToastProps, useFocusRing, useToast } from "react-aria";
import { ToastState } from "react-stately";

import { tv } from "../../../tailwind-merge.config";
import { elementFocus, focusStyles } from "../../lib/styling";
import Button from "../button/button";

const toastVariants = tv({
  slots: {
    base: [
      "bg-content text-content-fg rounded-md p-2 outline-none border-1 border-neutral shadow-md",
      "flex grow gap-6 items-center transition-shadow max-w-100",
      elementFocus,
      focusStyles,
    ],
    closeButton: "p-0.5 self-stretch",
    content: "flex flex-col shrink",
    contentWrapper: "flex items-center gap-2 grow",
    description: "text-muted text-xs font-light",
    title: "font-bold text-xs whitespace-nowrap",
  },
  variants: {
    behind: {
      true: {
        closeButton: "invisible",
        contentWrapper: "invisible",
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

const Toast = ({
  expanded,
  forwardedRef,
  ref: outerRef,
  state,
  ...props
}: ToastProps) => {
  const { base, closeButton, content, contentWrapper, description, title } =
    toastVariants({
      behind: forwardedRef === undefined && !expanded,
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
        <X size={16} />
      </Button>
    </div>
  );
};

export default Toast;
