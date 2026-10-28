import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { startActiveTimer } from "@/lib/data/active-timers";
import { getDeliverable } from "@/lib/data/deliverables";
import { getProject } from "@/lib/data/projects";
import { projectPath } from "@/lib/projects/detail";
import type { AttributableDeliverable } from "@/lib/time/attribution";
import { BILLABLE_VALUE } from "@/lib/time/form";
import {
  INITIAL_START_TIMER_STATE,
  START_TIMER_NO_DAY,
  START_TIMER_PROBLEMS,
  START_TIMER_UNKNOWN_DELIVERABLE,
  STARTED_ON_FIELD,
} from "@/lib/time/start";

import { writeTimerStart } from "./timer-writes";

/**
 * Mocked collaborators rather than a database: this function's own job is the
 * branching — reject, refuse, start — and the validation and the writes are
 * each already tested where they live.
 */
vi.mock("@/lib/data/active-timers", () => ({
  startActiveTimer: vi.fn(),
  stopActiveTimer: vi.fn(),
  discardActiveTimer: vi.fn(),
  getActiveTimer: vi.fn(),
}));
vi.mock("@/lib/data/deliverables", () => ({ getDeliverable: vi.fn() }));
vi.mock("@/lib/data/projects", () => ({ getProject: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const project = vi.mocked(getProject);
const start = vi.mocked(startActiveTimer);
const deliverable = vi.mocked(getDeliverable);

const OFFERED: AttributableDeliverable[] = [
  { id: "dlv_wireframes", title: "Wireframes", estimatedMinutes: 360 },
  { id: "dlv_build", title: "Build", estimatedMinutes: 0 },
];

const TIMER = {
  id: "tmr_1",
  slot: "only",
  projectId: "prj_engine",
  deliverableId: null,
  note: null,
  billable: true,
  startedAt: "2026-10-28T09:00:00.000Z",
  startedOn: "2026-10-28",
};

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

function press(values: Record<string, string> = {}) {
  return writeTimerStart(
    "prj_engine",
    OFFERED,
    INITIAL_START_TIMER_STATE,
    submit({
      [STARTED_ON_FIELD]: "2026-10-28",
      billable: BILLABLE_VALUE,
      ...values,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Enough of a project for the existence check in front of the write.
  project.mockResolvedValue({
    id: "prj_engine",
    name: "Engine rewrite",
  } as never);
  start.mockResolvedValue({ ok: true, timer: TIMER });
});

describe("writeTimerStart", () => {
  it("starts the clock against the project the page captured", async () => {
    await press({ note: "Pairing on the importer" });

    expect(start).toHaveBeenCalledWith({
      projectId: "prj_engine",
      deliverableId: null,
      note: "Pairing on the importer",
      billable: true,
      startedOn: "2026-10-28",
    });
  });

  it("reports the clock it started, naming the line it is on", async () => {
    start.mockResolvedValue({
      ok: true,
      timer: { ...TIMER, deliverableId: "dlv_build" },
    });

    const state = await press({ deliverable: "dlv_build" });

    expect(state.started).toEqual({
      id: "tmr_1",
      deliverableTitle: "Build",
      billable: true,
    });
  });

  it("revalidates the project, because the clock is read off the page", async () => {
    await press();

    expect(revalidatePath).toHaveBeenCalledWith(projectPath("prj_engine"));
  });

  it("writes nothing and keeps the message beside the picker", async () => {
    const state = await press({ deliverable: "dlv_gone" });

    expect(start).not.toHaveBeenCalled();
    expect(state.errors.deliverable).toBe(START_TIMER_UNKNOWN_DELIVERABLE);
    expect(state.formError).toBeNull();
  });

  it("puts a missing day on the form, where the reader can act on it", async () => {
    const state = await press({ [STARTED_ON_FIELD]: "" });

    expect(start).not.toHaveBeenCalled();
    expect(state.formError).toBe(START_TIMER_NO_DAY);
  });

  it("says so when the project has been deleted under the page", async () => {
    project.mockResolvedValue(null);

    const state = await press();

    expect(start).not.toHaveBeenCalled();
    expect(state.formError).toBe(START_TIMER_PROBLEMS.missingProject);
  });

  it("names the project a clock is already running on", async () => {
    start.mockResolvedValue({
      ok: false,
      refusal: "already-running",
      running: { ...TIMER, projectId: "prj_brand" },
    });
    project.mockImplementation(async (id: string) =>
      id === "prj_brand"
        ? ({ id, name: "Brand refresh" } as never)
        : ({ id, name: "Engine rewrite" } as never),
    );

    const state = await press();

    expect(state.formError).toContain("Brand refresh");
    expect(state.started).toBeNull();
  });

  it("names this project when the race was on this one", async () => {
    start.mockResolvedValue({
      ok: false,
      refusal: "already-running",
      running: TIMER,
    });

    const state = await press();

    expect(state.formError).toContain("Engine rewrite");
    // The project it already has is reused rather than read a second time.
    expect(project).toHaveBeenCalledTimes(1);
  });

  it("explains a dropped line rather than telling the reader to retry", async () => {
    start.mockRejectedValue(new Error("no deliverable with id dlv_build"));
    deliverable.mockResolvedValue(null);

    const state = await press({ deliverable: "dlv_build" });

    expect(state.formError).toBe(START_TIMER_PROBLEMS.missingDeliverable);
  });

  it("falls back to try again when the write failed for some other reason", async () => {
    start.mockRejectedValue(new Error("database is locked"));
    deliverable.mockResolvedValue({ id: "dlv_build" } as never);

    const state = await press({ deliverable: "dlv_build" });

    expect(state.formError).toBe(START_TIMER_PROBLEMS.failed);
  });

  it("does not revalidate a page nothing was written for", async () => {
    start.mockRejectedValue(new Error("database is locked"));

    const state = await press();

    expect(revalidatePath).not.toHaveBeenCalled();
    expect(state.started).toBeNull();
  });
});
