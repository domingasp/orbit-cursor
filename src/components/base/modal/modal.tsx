import {
  ModalOverlay as AriaModalOverlay,
  ModalOverlayProps as AriaModalOverlayProps,
  Modal as AriaModal,
} from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";

const modalVariants = tv({
  slots: {
    modal:
      "w-full max-w-md overflow-hidden rounded-md bg-content p-4 text-content-fg border border-muted/10 outline-none shadow-md",
    overlay: [
      "fixed inset-0 z-10 overflow-y-auto bg-content/20 flex min-h-full items-center justify-center p-4 backdrop-blur-sm outline-none",
      "data-[entering]:animate-in data-[entering]:fade-in data-[entering]:ease-out",
      "data-[exiting]:animate-out data-[exiting]:fade-out data-[exiting]:ease-in",
    ],
  },
});

type ModalProps = AriaModalOverlayProps &
  VariantProps<typeof modalVariants> & { className?: string };

export const Modal = ({ children, className, ...props }: ModalProps) => {
  const { modal, overlay } = modalVariants();
  return (
    <AriaModalOverlay {...props} className={overlay()}>
      <AriaModal className={modal({ className })}>{children}</AriaModal>
    </AriaModalOverlay>
  );
};
