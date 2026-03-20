import { memo } from "react";
import { Button } from "@/components/ui/button";

interface FilterTabsProps {
  selected: string;
  onChange: (value: string) => void;
}

const periods = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
];

export const FilterTabs = memo(({ selected, onChange }: FilterTabsProps) => {
  return (
    <div className="flex gap-2">
      {periods.map((period) => (
        <Button
          key={period.value}
          variant={selected === period.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(period.value)}
          className="text-xs"
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
});

FilterTabs.displayName = "FilterTabs";
