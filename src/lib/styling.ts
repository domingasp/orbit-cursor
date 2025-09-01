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

/**
 * Remove `data-hovered`, `data-focused`, and `data-focus-visible` attributes on element with data-focused
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

/**
 * Extract variant options from a Tailwind Variants object
 */
export const extractAvailableVariantOptions = <
  T extends Record<string, Record<string, unknown>>,
  K extends keyof T
>(
  obj: T,
  property: K
): Array<keyof T[K]> => {
  return Object.keys(obj[property]) as Array<keyof T[K]>;
};
