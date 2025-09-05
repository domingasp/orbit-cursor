import { ClassValue, cn as cnTwMerge } from "tailwind-variants";

export function availableVariants<T extends readonly string[]>(
  ...keys: T
): Record<T[number], string> {
  return Object.fromEntries(keys.map((key) => [key, ""])) as Record<
    T[number],
    string
  >;
}

// Temporary, until tailwind-variants fixes this
// https://github.com/heroui-inc/tailwind-variants/issues/268
export const cn = (...classes: ClassValue[]) =>
  cnTwMerge(classes)({ twMerge: true }) as string;

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
 * Extract single variant options from a Tailwind Variants object
 */
export const getVariantOptions =
  <C extends React.ElementType>(tvVariants: { variants?: unknown }) =>
  <V extends keyof React.ComponentProps<C>>(
    variant: V,
  ): React.ComponentProps<C>[V][] => {
    if (tvVariants.variants && typeof tvVariants.variants === "object") {
      const variantOptions = tvVariants.variants[variant as string] as unknown;
      if (variantOptions && typeof variantOptions === "object") {
        return Object.keys(variantOptions) as React.ComponentProps<C>[V][];
      }
    }
    return [];
  };
