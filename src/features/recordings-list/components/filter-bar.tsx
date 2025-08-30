import {
  ArrowDownNarrowWide,
  ArrowDownWideNarrow,
  Clock,
  HardDrive,
  Search,
  X,
} from "lucide-react";

import { Button } from "../../../components/base/button/button";
import { ToggleButton } from "../../../components/base/button/toggle-button";
import { TextField } from "../../../components/base/input-fields/text-field";
import { ListBoxItem } from "../../../components/base/listbox-item/listbox-item";
import { Select } from "../../../components/base/select/select";

type FilterBarProps = {
  setDescending: (desc: boolean) => void;
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
  setSorting?: (by: "date" | "size") => void;
};

export const FilterBar = ({
  searchTerm,
  setDescending,
  setSearchTerm,
  setSorting,
}: FilterBarProps) => {
  return (
    <div className="flex items-center justify-between gap-2 px-2">
      <TextField
        className="w-[50%]"
        onChange={setSearchTerm}
        placeholder="Search"
        size="sm"
        value={searchTerm}
        variant="line"
        rightSection={
          <div className="flex items-center gap-1">
            <Button
              className="translate-y-0"
              color="muted"
              onPress={() => setSearchTerm?.("")}
              size="xs"
              variant="ghost"
              icon
            >
              <X size={12} />
            </Button>
            <Search size={14} />
          </div>
        }
        compact
      />

      <div className="flex items-center gap-1">
        <Select
          key="date"
          aria-label="Sort recordings by"
          className="w-23"
          clearable={false}
          defaultSelectedKey="date"
          size="sm"
          variant="line"
          onSelectionChange={(key) => {
            setSorting?.(key as "date" | "size");
          }}
          compact
        >
          <ListBoxItem id="date" size="sm" compact>
            <div className="flex items-center gap-2">
              <Clock className="text-muted! shrink-0" size={12} />
              Date
            </div>
          </ListBoxItem>

          <ListBoxItem id="size" size="sm" compact>
            <div className="flex items-center gap-2">
              <HardDrive className="text-muted! shrink-0" size={12} />
              Size
            </div>
          </ListBoxItem>
        </Select>

        <ToggleButton
          aria-label="Sort recordings ascending/descending"
          off={<ArrowDownNarrowWide className="text-info" size={16} />}
          onChange={setDescending}
          size="sm"
          variant="ghost"
          defaultSelected
        >
          <ArrowDownWideNarrow className="text-white" size={16} />
        </ToggleButton>
      </div>
    </div>
  );
};
