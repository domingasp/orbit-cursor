import { useEffect, useState } from "react";

import { Button } from "../../../components/base/button/button";
import { OverflowShadow } from "../../../components/base/overflow-shadow/overflow-shadow";
import { listMonitors, MonitorDetails } from "../api/recording-sources";

type MonitorSelectorProps = {
  onSelect: (monitor: MonitorDetails) => void;
  selectedMonitor: MonitorDetails | null;
};

export const MonitorSelector = ({
  onSelect,
  selectedMonitor,
}: MonitorSelectorProps) => {
  const [monitors, setMonitors] = useState<MonitorDetails[]>([]);

  const bounds = monitors.reduce(
    (acc, { position: { x, y }, size: { height, width } }) => ({
      maxX: Math.max(acc.maxX, x + width),
      maxY: Math.max(acc.maxY, y + height),
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
    }),
    {
      maxX: -Infinity,
      maxY: -Infinity,
      minX: Infinity,
      minY: Infinity,
    }
  );

  const layoutWidth = bounds.maxX - bounds.minX;
  const layoutHeight = bounds.maxY - bounds.minY;
  const aspectRatio = layoutWidth / layoutHeight;

  useEffect(() => {
    void listMonitors().then((monitors) => {
      setMonitors(monitors);
    });
  }, []);

  return (
    <OverflowShadow
      className="relative"
      orientation="vertical"
      viewportClassName="flex items-center justify-center"
      style={{
        aspectRatio,
        height: `min(80%, 80vw / (${aspectRatio.toString()}))`,
      }}
      insetShadow
    >
      {monitors.map((monitor) => {
        const { id, name, position, size } = monitor;
        const left = ((position.x - bounds.minX) / layoutWidth) * 100;
        const top = ((position.y - bounds.minY) / layoutHeight) * 100;
        const width = (size.width / layoutWidth) * 100;
        const height = (size.height / layoutHeight) * 100;

        return (
          <Button
            key={id}
            className="absolute justify-center shadow-md text-xxs"
            variant="soft"
            color={
              selectedMonitor && selectedMonitor.id === id ? "info" : "neutral"
            }
            onPress={() => {
              onSelect(monitor);
            }}
            style={{
              height: `${height.toString()}%`,
              left: `${left.toString()}%`,
              top: `${top.toString()}%`,
              width: `${width.toString()}%`,
            }}
          >
            <span className="truncate w-full">{name}</span>
          </Button>
        );
      })}
    </OverflowShadow>
  );
};
