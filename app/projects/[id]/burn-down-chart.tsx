import type { BurnDownChart as BurnDownChartModel } from "@/lib/burndown/chart";
import { describeLineEnd } from "@/lib/burndown/describe";

/**
 * How far the labels sit from the thing they label, in user units.
 *
 * Money hangs to the left of its gridline, days hang below the plot, and the
 * figure on the end of the line is pinned to the right-hand edge of the
 * picture rather than offset from the dot. That last one is what keeps a long
 * amount from running off the edge: a label anchored to the box grows
 * leftwards into the margin that was reserved for it, where one offset from
 * the dot would grow outwards into nothing.
 */
const MONEY_LABEL_GAP = 10;
const DAY_LABEL_DROP = 20;
const END_LABEL_INSET = 8;

/**
 * Half the height of a line of axis text, for sitting a label on the middle
 * of what it names rather than hanging it from the baseline.
 */
const TEXT_MIDDLE = 4;

/** The line itself, and the dot on the end of it. */
const LINE_WIDTH = 2;
const END_DOT_RADIUS = 4;
const SURFACE_RING = 2;

/** The wash under the line: a tint, never a block of colour. */
const WASH_OPACITY = 0.1;

/**
 * One project's burn-down, as inline SVG.
 *
 * No client code and no charting library. Every coordinate on the picture was
 * worked out by `lib/burndown/chart.ts` before this component was called, so
 * what is here is a list of elements with numbers already in them — which is
 * the whole reason a server-rendered chart is worth doing. There is nothing
 * to hydrate, nothing to re-measure, and nothing that can be wrong about the
 * data that is not covered by a test of a pure function.
 *
 * The picture is drawn once at a fixed size and scaled by the browser, since
 * nothing on the server knows how wide the reader's window is. Text scales
 * with it, which is the cost: a label cannot be re-laid-out at the reader's
 * width, so every label is placed somewhere it cannot collide at any width.
 *
 * It is a single series, so there is no legend: the heading above says what
 * is plotted and the one direct label says where it ended. The only second
 * colour is the overrun, and that is a state rather than a series — it is
 * labelled in words as well, because a colour that means something on its own
 * means nothing to a reader who cannot see it.
 */
export function BurnDownChart({
  chart,
  description,
  idPrefix,
}: {
  /** Every coordinate of the picture, from `burnDownChart`. */
  chart: BurnDownChartModel;
  /** The line in a sentence, for a reader who is not looking at it. */
  description: string;
  /**
   * What this chart's own clip paths are called.
   *
   * SVG ids are global to the document, so two charts on one page sharing an
   * id would clip each other's washes. The project id is what makes them
   * unique, and it is passed in rather than generated so the markup the
   * server sends is the markup it would send again.
   */
  idPrefix: string;
}) {
  const { area, box, last } = chart;
  const inHandClip = `${idPrefix}-in-hand`;
  const overrunClip = `${idPrefix}-overrun`;

  return (
    <svg
      viewBox={`0 0 ${box.width} ${box.height}`}
      className="mt-4 w-full"
      role="img"
    >
      <title>{description}</title>
      <defs>
        {chart.inHand === null ? null : (
          <clipPath id={inHandClip}>
            <rect {...chart.inHand} />
          </clipPath>
        )}
        {chart.overrun === null ? null : (
          <clipPath id={overrunClip}>
            <rect {...chart.overrun} />
          </clipPath>
        )}
      </defs>

      {/*
        The reconstructed stretches go down first, behind everything, because
        they are a fact about the period rather than about the readings — see
        `reconstructedBands`. The caveat above the chart names their days, so
        this shading is a reminder rather than the only telling.
      */}
      {chart.reconstructed.map((band) => (
        <rect
          key={band.x}
          x={band.x}
          y={area.top}
          width={band.width}
          height={area.height}
          fill="var(--chart-band)"
        />
      ))}

      {/*
        Gridlines and the rule along the bottom: hairline, solid, one step off
        the surface. They are the thing the line is read against and should
        never be the thing noticed.
      */}
      {chart.moneyTicks.map((tick) => (
        <line
          key={tick.cents}
          x1={area.left}
          y1={tick.y}
          x2={area.right}
          y2={tick.y}
          stroke="var(--chart-grid)"
          strokeWidth={1}
        />
      ))}
      <line
        x1={area.left}
        y1={area.bottom}
        x2={area.right}
        y2={area.bottom}
        stroke="var(--chart-grid)"
        strokeWidth={1}
      />

      {/*
        The same closed shape twice, through two clips: the budget still in
        hand above the baseline, and the part spent past it below. One path,
        so the two meet exactly on the line where the money runs out.
      */}
      {chart.areaPath === "" ? null : (
        <>
          {chart.inHand === null ? null : (
            <path
              d={chart.areaPath}
              clipPath={`url(#${inHandClip})`}
              fill="var(--chart-line)"
              fillOpacity={WASH_OPACITY}
            />
          )}
          {chart.overrun === null ? null : (
            <path
              d={chart.areaPath}
              clipPath={`url(#${overrunClip})`}
              fill="var(--chart-over)"
              fillOpacity={WASH_OPACITY}
            />
          )}
        </>
      )}

      <path
        d={chart.linePath}
        fill="none"
        stroke="var(--chart-line)"
        strokeWidth={LINE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/*
        The dot on the end, with a ring in the surface colour so it stays
        legible where it sits on a gridline. It is the only marker on the
        chart: a dot per reading would be a dot per day.
      */}
      <circle
        cx={last.x}
        cy={last.y}
        r={END_DOT_RADIUS}
        fill={last.reading.remainingCents < 0 ? "var(--chart-over)" : "var(--chart-line)"}
        stroke="var(--chart-surface)"
        strokeWidth={SURFACE_RING}
      />

      {chart.moneyTicks.map((tick) => (
        <text
          key={tick.cents}
          x={area.left - MONEY_LABEL_GAP}
          y={tick.y + TEXT_MIDDLE}
          textAnchor="end"
          fontSize={11}
          className="fill-zinc-500 tabular-nums dark:fill-zinc-400"
        >
          {tick.label}
        </text>
      ))}

      {chart.dateTicks.map((tick) => (
        <text
          key={tick.onDate}
          x={tick.x}
          y={area.bottom + DAY_LABEL_DROP}
          textAnchor={tick.anchor}
          fontSize={11}
          className="fill-zinc-500 tabular-nums dark:fill-zinc-400"
        >
          {tick.label}
        </text>
      ))}

      {/*
        The one number printed on the chart, in the page's own ink rather than
        in the series colour: the mark beside it carries the identity, and
        coloured text on a chart is how a figure becomes decoration.
      */}
      <text
        x={box.width - END_LABEL_INSET}
        y={last.y + TEXT_MIDDLE}
        textAnchor="end"
        fontSize={11}
        className="fill-zinc-900 tabular-nums dark:fill-zinc-100"
      >
        {describeLineEnd(last.reading)}
      </text>
    </svg>
  );
}
