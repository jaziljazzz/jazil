"use client";

import { useMemo, useState } from "react";
import { addDays, dayKey, fmtDateTime, zoned } from "@/lib/format";
import { Chip, cn } from "./ui";

function at(daysFromNow: number, hh = 10, mm = 0) {
  return zoned(dayKey(addDays(new Date(), daysFromNow)), hh, mm);
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Quick chips first (In 2 hours, Tomorrow 10 AM, In 3 days, Next week), suggested cadence, then Custom. */
export function FollowupPicker({ value, onChange, attempt = 0, cadence = [1, 3, 7, 15, 30], required = true }: {
  value: Date | null;
  onChange: (d: Date | null) => void;
  attempt?: number;
  cadence?: number[];
  required?: boolean;
}) {
  const [custom, setCustom] = useState(false);
  const suggestedDays = cadence[Math.min(attempt, cadence.length - 1)] ?? 1;
  const options = useMemo(() => {
    const list: { key: string; label: string; date: Date }[] = [
      { key: "2h", label: "In 2 hours", date: new Date(Date.now() + 2 * 3600000) },
      { key: "tom", label: "Tomorrow 10 AM", date: at(1) },
      { key: "3d", label: "In 3 days", date: at(3) },
      { key: "1w", label: "Next week", date: at(7) },
    ];
    if (![1, 3, 7].includes(suggestedDays)) {
      list.splice(1, 0, { key: "sug", label: `Day ${suggestedDays}`, date: at(suggestedDays) });
    }
    return list;
  }, [suggestedDays]);

  const selectedKey = value && !custom ? options.find((o) => Math.abs(o.date.getTime() - value.getTime()) < 60000)?.key : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted">
          Next follow up{required && <span className="text-danger"> *</span>}
        </span>
        <span className="text-[12px] text-muted">Suggested: day {suggestedDays} (attempt {attempt + 1})</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip
            key={o.key}
            active={selectedKey === o.key}
            onClick={() => {
              setCustom(false);
              onChange(o.date);
            }}
            className={cn(o.key === "sug" && selectedKey !== o.key && "border-brand/40 text-brand")}
          >
            {o.label}
          </Chip>
        ))}
        <Chip active={custom} onClick={() => setCustom(true)}>Custom</Chip>
      </div>
      {custom && (
        <input
          type="datetime-local"
          className="h-11 w-full rounded-lg border border-line bg-surface px-3 outline-none focus:border-brand md:h-9"
          min={toLocalInput(new Date())}
          value={value ? toLocalInput(value) : ""}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
        />
      )}
      {value && <p className="text-[13px] font-medium text-brand">{fmtDateTime(value)}</p>}
    </div>
  );
}
