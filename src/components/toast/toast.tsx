import { X } from "lucide-react";
import { Ref, useImperativeHandle, useRef } from "react";
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
      "flex gap-6 items-center transition-shadow",
      elementFocus,
      focusStyles,
    ],
    content: "flex flex-col",
    contentWrapper: "flex items-center gap-2",
    description: "text-muted text-xs font-light",
    title: "font-bold text-xs",
  },
});

export type ToastContent = {
  title: string;
  description?: string;
  leftSection?: React.ReactNode;
};

type ToastProps = AriaToastProps<ToastContent> & {
  state: ToastState<ToastContent>;
  ref?: Ref<HTMLDivElement>;
};

const Toast = ({ ref: outerRef, state, ...props }: ToastProps) => {
  const { base, content, contentWrapper, description, title } = toastVariants();

  const ref = useRef(null);
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
      ref={ref}
      className={base()}
    >
      <div {...contentProps} className={contentWrapper()}>
        {props.toast.content.leftSection}

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
        className="p-0.5 self-stretch"
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
