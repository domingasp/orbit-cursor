import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}

export function availableVariants<T extends readonly string[]>(
  ...keys: T
): Record<T[number], string> {
  return Object.fromEntries(keys.map((key) => [key, ""])) as Record<
    T[number],
    string
  >;
}

export const focusStyles =
  "outline-none ring-content-fg/75 ring-offset-content";

export const elementFocus =
  "data-[focus-visible]:ring-offset-1 data-[focus-visible]:ring-1";

export const groupFocus =
  "group-data-[focus-visible]:ring-offset-1 group-data-[focus-visible]:ring-1";

export const focusWithin =
  "data-[focus-within]:ring-offset-1 data-[focus-within]:ring-1";

/**
 * Remove `data-hovered`, `data-focused`, and `data-focus-visible` attributes on element with data-focused.
 */
export const clearInteractionAttributes = () => {
  const activeElement = document.querySelector('[data-focused="true"]');
  if (activeElement && activeElement instanceof HTMLElement) {
    activeElement.blur();
    activeElement.removeAttribute("data-hovered");
    activeElement.removeAttribute("data-focused");
    activeElement.removeAttribute("data-focus-visible");
  }
};
