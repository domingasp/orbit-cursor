import { ResizeDirection } from "../../types";

const boundaryMap: Record<
  ResizeDirection,
  { rotation: number; type: "l" | "straight" }
> = {
  bottom: { rotation: 180, type: "straight" },
  bottomLeft: { rotation: 270, type: "l" },
  bottomRight: { rotation: 180, type: "l" },
  left: { rotation: 270, type: "straight" },
  right: { rotation: 90, type: "straight" },
  top: { rotation: 0, type: "straight" },
  topLeft: { rotation: 0, type: "l" },
  topRight: { rotation: 90, type: "l" },
};

type BoundaryProps = {
  direction: ResizeDirection;
};

export const Boundary = ({ direction }: BoundaryProps) => {
  const { rotation, type } = boundaryMap[direction];

  const fill = "fill-content-fg/10";
  return (
    <svg
      className="absolute inset-0"
      style={{ transform: `rotate(${rotation.toString()}deg)` }}
      viewBox="0 0 100 100"
    >
      {type === "straight" ? (
        <rect className={fill} height="50" width="100" x="0" y="0" />
      ) : (
        <path className={fill} d="M 0 0 H 100 V 50 H 50 V 100 H 0 Z" />
      )}
    </svg>
  );
};
