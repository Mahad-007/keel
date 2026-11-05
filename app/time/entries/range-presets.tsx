import { TabBar, TabLink } from "@/components/nav/tab-bar";
import { timeLogHref, withRange, type TimeLogQuery } from "@/lib/time/log-query";
import {
  matchingPreset,
  presetRange,
  RANGE_PRESETS,
  rangePresetLabel,
} from "@/lib/time/range-presets";

/**
 * The date ranges worth one click, as links.
 *
 * Links rather than buttons in the form below, so a preset is a navigation
 * like every other filter here: no JavaScript, the back button works, and the
 * range somebody landed on is an address they can send on. Each one carries
 * the other three filters along, so clicking "This month" on a client's
 * unbilled time narrows the days without widening anything else.
 *
 * The current one is marked by comparing the dates rather than by a fifth
 * param, so a range that was typed into the two boxes and happens to be this
 * month is marked as this month — and a link kept from last week does not
 * claim to be showing the week it is now.
 */
export function RangePresets({
  query,
  today,
}: {
  query: TimeLogQuery;
  /** The day the reader is standing on, which the presets are measured from. */
  today: string;
}) {
  const current = matchingPreset(query.range, today);

  return (
    <TabBar label="Filter the time log by date range">
      {RANGE_PRESETS.map((preset) => (
        <TabLink
          key={preset}
          href={timeLogHref(withRange(query, presetRange(preset, today)))}
          current={preset === current}
        >
          {rangePresetLabel(preset)}
        </TabLink>
      ))}
    </TabBar>
  );
}
