import { useQuery } from "@tanstack/react-query";

import { OverflowShadow } from "../../../components/base/overflow-shadow/overflow-shadow";
import { listRecordings } from "../api/recordings";

import { RecordingItem } from "./recording-item";

export const RecordingsList = () => {
  const { data: recordings } = useQuery({
    queryFn: listRecordings,
    queryKey: ["recordings"],
  });

  return (
    <div className="h-full p-1 flex flex-col">
      <OverflowShadow
        className="p-2"
        orientation="vertical"
        shadowRadius="md"
        insetShadow
      >
        <div className="flex flex-col gap-2 items-center-safe justify-center-safe">
          {recordings?.map((recording) => (
            <RecordingItem key={recording.id} recording={recording} />
          ))}
        </div>
      </OverflowShadow>
    </div>
  );
};
