import { ComponentProps, createContext, useContext } from "react";

import {
  ExtendedToastState,
  useExtendedToastState,
} from "./extended-toast-state";
import { ToastContent } from "./toast";
import { ToastRegion } from "./toast-region";

type ToastContextType = ExtendedToastState<ToastContent> | null;

const ToastContext = createContext<ToastContextType>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
};

type ToastProviderProps = Omit<ComponentProps<typeof ToastRegion>, "state"> & {
  children: React.ReactNode;
};

export const ToastProvider = ({ children, ...props }: ToastProviderProps) => {
  const state = useExtendedToastState<ToastContent>({
    maxVisibleToasts: 3,
  });

  return (
    <ToastContext.Provider value={state}>
      {children}
      <ToastRegion {...props} state={state} />
    </ToastContext.Provider>
  );
};
