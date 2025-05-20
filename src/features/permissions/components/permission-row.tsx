import { Check, Sparkle } from "lucide-react";
import { ComponentProps } from "react";
import { TooltipTrigger } from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { openSystemSettings } from "../../../api/permissions";
import Button from "../../../components/button/button";
import Sparkles from "../../../components/sparkles/sparkles";
import Tooltip from "../../../components/tooltip/tooltip";
import { Permissions } from "../../../stores/permissions.store";
import Gradients from "../types/gradients";

const sparkles = {
  colors: ["#FFFFFF"],
  duration: { max: 2.5, min: 0.5 },
  icon: Sparkle,
  offset: { x: { max: 50, min: -10 }, y: { max: 50, min: -10 } },
  opacity: 0.4,
  scale: { max: 0.5, min: 0.2 },
  sparklesCount: 2,
} as ComponentProps<typeof Sparkles>;

type PermissionProps = {
  icon: React.ReactNode;
  title: string;
  color?: Gradients | string;
  description?: string;
  onClick?: () => void;
  status?: Permissions[keyof Permissions];
};
const PermissionRow = ({
  color = Gradients.Gray,
  description,
  icon,
  onClick,
  status,
  title,
}: PermissionProps) => {
  return (
    <div className="flex flex-row items-center gap-4">
      <div
        className={twMerge(
          "w-16 h-16 text-white rounded-2xl items-center justify-center flex",
          color
        )}
      >
        {icon}
      </div>
      <div className="flex flex-col grow text-content-fg">
        <span className="font-semibold">{title}</span>
        {description && (
          <span className="text-sm text-muted">{description}</span>
        )}
      </div>

      {status && (
        <>
          {status.hasAccess && (
            <div className={twMerge("flex justify-center w-[62px]")}>
              <Sparkles {...sparkles}>
                <Check className="text-success" size={32} />
              </Sparkles>
            </div>
          )}

          {!status.hasAccess && (
            <TooltipTrigger isDisabled={status.canRequest}>
              <Button
                onClick={() => {
                  if (onClick && status.canRequest) {
                    onClick();
                  } else {
                    openSystemSettings();
                  }
                }}
                shiny
              >
                {status.canRequest ? "Grant" : "Open System Settings"}
              </Button>

              <Tooltip size="sm">Enable manually</Tooltip>
            </TooltipTrigger>
          )}
        </>
      )}
    </div>
  );
};

export default PermissionRow;
