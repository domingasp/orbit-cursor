import { Orbit } from "lucide-react";
import React, { useMemo, useState } from "react";
import { CheckboxGroup } from "react-aria-components";

import { Badge } from "../../../components/base/badge/badge";
import { OverflowShadow } from "../../../components/base/overflow-shadow/overflow-shadow";
import { Separator } from "../../../components/base/separator/separator";
import { formatDate } from "../../../lib/format";
import { RecordingMetadata } from "../api/recordings";

import { FilterBar } from "./filter-bar";
import { RecordingItem } from "./recording-item";
import { Titlebar } from "./titlebar";

type RecordingsProps = {
  recordings: RecordingMetadata[];
  currentlyOpenId?: number;
  group?: boolean;
  isRecentlyDeletedVisible?: boolean;
  searchTerm?: string;
};
const Recordings = ({
  currentlyOpenId,
  group = true,
  isRecentlyDeletedVisible,
  recordings,
  searchTerm,
}: RecordingsProps) => {
  const groupByDate = (items: RecordingMetadata[]) =>
    items.reduce<Record<string, RecordingMetadata[]>>((groups, item) => {
      const dateKey = new Date(item.createdAt).toDateString();
      groups[dateKey] = groups[dateKey] ?? [];
      groups[dateKey].push(item);
      return groups;
    }, {});

  const renderRecordings = (items: RecordingMetadata[]) =>
    items.map((recording) => (
      <RecordingItem
        key={recording.id}
        isCurrentlyOpen={recording.id === currentlyOpenId}
        recording={recording}
        searchTerm={searchTerm}
      />
    ));

  if (!group) renderRecordings(recordings);

  return Object.entries(groupByDate(recordings)).map(([date, recs]) => (
    <React.Fragment key={date}>
      <Separator spacing="md">
        <Badge
          className="bg-content font-extralight"
          color={isRecentlyDeletedVisible ? "error" : "info"}
          size="sm"
          variant="ghost"
        >
          {formatDate(new Date(date))}
        </Badge>
      </Separator>

      {renderRecordings(recs)}
    </React.Fragment>
  ));
};

type RecordingsListProps = {
  recordings: RecordingMetadata[];
  selected: string[];
  setSelected: (selected: string[]) => void;
  currentlyOpenId?: number;
  onCancel?: () => void;
  onOpen?: (recordingId: number) => void;
  onRestore?: () => void;
  recentlyDeletedVisible?: boolean;
};

export const RecordingsList = ({
  currentlyOpenId,
  onCancel,
  onOpen,
  onRestore,
  recentlyDeletedVisible = false,
  recordings,
  selected,
  setSelected,
}: RecordingsListProps) => {
  const [sortKey, setSortKey] = useState<"date" | "size">("date");
  const [searchTerm, setSearchTerm] = useState("");
  const [descending, setDescending] = useState(true);

  const processedRecordings = useMemo(() => {
    let list = [...recordings];

    // filter deleted / non-deleted depending on view
    list = list.filter(({ deletedAt }) =>
      recentlyDeletedVisible ? deletedAt !== null : deletedAt === null
    );

    // search
    if (searchTerm.trim().length > 0) {
      const q = searchTerm.toLowerCase();
      list = list.filter(({ name }) => name.toLowerCase().includes(q));
    }

    // sort
    switch (sortKey) {
      case "date":
        list = list.sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return descending ? timeB - timeA : timeA - timeB;
        });
        break;
      case "size":
        list = list.sort((a, b) => {
          const sizeA = a.sizeBytes ?? 0;
          const sizeB = b.sizeBytes ?? 0;
          return descending ? sizeB - sizeA : sizeA - sizeB;
        });
        break;
      default:
        break;
    }

    return list;
  }, [recordings, recentlyDeletedVisible, searchTerm, sortKey, descending]);

  const totalCount = recentlyDeletedVisible
    ? recordings.filter((r) => r.deletedAt !== null).length
    : recordings.filter((r) => r.deletedAt === null).length;

  return (
    <div className="h-full p-1 flex flex-col gap-1">
      <Titlebar
        currentlyOpenId={currentlyOpenId}
        onCancel={onCancel}
        onOpen={onOpen}
        onRestore={onRestore}
        recentlyDeletedVisible={recentlyDeletedVisible}
        selected={selected}
        onClear={() => {
          setSelected([]);
        }}
      />

      <FilterBar
        searchTerm={searchTerm}
        setDescending={setDescending}
        setSearchTerm={setSearchTerm}
        setSorting={setSortKey}
      />

      <OverflowShadow
        className="p-2"
        orientation="vertical"
        shadowRadius="md"
        insetShadow
      >
        <CheckboxGroup
          className="flex flex-col gap-2 items-start-safe justify-center-safe"
          onChange={setSelected}
          value={selected}
        >
          <Recordings
            currentlyOpenId={currentlyOpenId}
            group={sortKey === "date"}
            isRecentlyDeletedVisible={recentlyDeletedVisible}
            recordings={processedRecordings}
            searchTerm={searchTerm}
          />

          <div className="flex items-center justify-center p-4 opacity-50">
            <Orbit className="animate-[spin_70s_linear_infinite_reverse] text-muted" />
            <span className="ml-2 text-xs text-muted font-light">
              {totalCount === 0
                ? "No Recordings"
                : `You have ${totalCount.toString()} recordings${
                    recentlyDeletedVisible ? " awaiting deletion" : ""
                  }`}
            </span>
          </div>
        </CheckboxGroup>
      </OverflowShadow>
    </div>
  );
};
