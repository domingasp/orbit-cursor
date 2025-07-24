import { ArrowLeft, Command } from "lucide-react";
import { TooltipTrigger } from "react-aria-components";

import { Keyboard } from "../../keyboard/keyboard";
import { Tooltip } from "../../tooltip/tooltip";

const mapKeyToIcon = (hotkey: string) => {
  const iconSize = 14;

  switch (hotkey) {
    case "left":
      return <ArrowLeft className="py-0.25" size={iconSize} />;
    case "meta":
      return <Command className="py-0.25" size={iconSize} />;
    default:
      return hotkey.charAt(0).toUpperCase() + hotkey.slice(1);
  }
};

type HotkeyTooltipProps = {
  children: React.ReactNode;
  hotkey: string;
};

export const HotkeyTooltip = ({ children, hotkey }: HotkeyTooltipProps) => {
  return (
    <TooltipTrigger isDisabled={!hotkey}>
      {children}

      <Tooltip
        className="flex flex-row gap-1 bg-transparent"
        offset={-8}
        withArrow={false}
      >
        {hotkey.split("+").map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            <Keyboard
              key={key}
              className="text-xxs h-4 border-1 border-content-fg/5"
              size="xs"
            >
              {mapKeyToIcon(key)}
            </Keyboard>
          </span>
        ))}
      </Tooltip>
    </TooltipTrigger>
  );
};
