import { useRef } from "react";
import { ToastState, useToastState } from "react-stately";

export interface ExtendedToastState<T> extends ToastState<T> {
  closeAll(): void;
}

export const useExtendedToastState = <T>(
  options: Parameters<typeof useToastState<T>>[0]
): ExtendedToastState<T> => {
  const state = useToastState<T>(options);
  const toastKeys = useRef<Set<string>>(new Set());

  const ariaAdd = state.add.bind(state);
  const ariaClose = state.close.bind(state);

  const add: typeof state.add = (content, options) => {
    const key = ariaAdd(content, options);
    toastKeys.current.add(key);
    return key;
  };

  const close: typeof state.close = (key) => {
    toastKeys.current.delete(key);
    ariaClose(key);
  };

  const closeAll = () => {
    for (const key of toastKeys.current) ariaClose(key);
    toastKeys.current.clear();
  };

  return {
    ...state,
    add,
    close,
    closeAll,
  };
};
