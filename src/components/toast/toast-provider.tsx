import { createContext, useContext } from "react";
import { ToastState, useToastState } from "react-stately";

import { ToastContent } from "./toast";
import ToastRegion from "./toast-region";

type ToastContextType = ToastState<ToastContent> | null;

const ToastContext = createContext<ToastContextType>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
};

type ToastProviderProps = {
  children: React.ReactNode;
};

const ToastProvider = ({ children }: ToastProviderProps) => {
  const state = useToastState<ToastContent>({
    maxVisibleToasts: 3,
  });

  return (
    <ToastContext.Provider value={state}>
      {children}
      <ToastRegion state={state} />
    </ToastContext.Provider>
  );
};

export default ToastProvider;
