import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getProject } from "@/lib/data/projects";
import { createTimeEntry } from "@/lib/data/time-entries";
import { projectPath } from "@/lib/projects/detail";
import type { AttributableDeliverable } from "@/lib/time/attribution";
import {
  BILLABLE_VALUE,
  INITIAL_LOG_TIME_STATE,
  TIME_PROBLEMS,
} from "@/lib/time/form";

import { writeTimeEntry } from "./time-writes";

/**
 * Mocked collaborators rather than a database: this function's own job is the
 * branching — reject, refuse, write — and the validation and the insert are
 * each already tested where they live.
 */
vi.mock("@/lib/data/projects", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/data/time-entries", () => ({ createTimeEntry: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const project = vi.mocked(getProject);
const created = vi.mocked(createTimeEntry);

const OFFERED: AttributableDeliverable[] = [
  { id: "dlv_wireframes", title: "Wireframes", estimatedMinutes: 360 },
  { id: "dlv_build", title: "Build", estimatedMinutes: 0 },
];

const ENTRY = {
  id: "tme_1",
  projectId: "prj_engine",
  deliverableId: null,
  minutes: 90,
  note: null,
  workedOn: "2026-10-17",
  billable: true,
  billedInvoiceId: null,
  createdAt: "2026-10-17T18:00:00.000Z",
  updatedAt: "2026-10-17T18:00:00.000Z",
};

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

function log(values: Record<string, string> = {}) {
  return writeTimeEntry(
    "prj_engine",
    OFFERED,
    INITIAL_LOG_TIME_STATE,
    submit({
      duration: "1h30m",
      workedOn: "2026-10-17",
      billable: BILLABLE_VALUE,
      ...values,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Enough of a project for the existence check in front of the write.
  project.mockResolvedValue({ id: "prj_engine" } as never);
  created.mockResolvedValue(ENTRY);
});

describe("writeTimeEntry", () => {
  it("writes the entry against the project the page captured", async () => {
    await log({ note: "Paired on the booking flow" });

    expect(created).toHaveBeenCalledWith({
      projectId: "prj_engine",
      minutes: 90,
      workedOn: "2026-10-17",
      deliverableId: null,
      note: "Paired on the booking flow",
      billable: true,
    });
  });

  it("attributes the entry to a line that was on the picker", async () => {
    created.mockResolvedValue({ ...ENTRY, deliverableId: "dlv_build" });

    const state = await log({ deliverable: "dlv_build" });

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({ deliverableId: "dlv_build" }),
    );
    expect(state.logged?.deliverableTitle).toBe("Build");
  });

  it("reports the entry as the columns hold it", async () => {
    const state = await log();

    expect(state.logged).toEqual({
      id: "tme_1",
      minutes: 90,
      workedOn: "2026-10-17",
      deliverableTitle: null,
      billable: true,
    });
  });

  it("re-renders the page, which is where the entry is read back", async () => {
    await log();

    expect(revalidatePath).toHaveBeenCalledWith(projectPath("prj_engine"));
  });

  it("writes nothing when a field is wrong", async () => {
    const state = await log({ duration: "ages" });

    expect(created).not.toHaveBeenCalled();
    expect(state.errors.duration).toBeDefined();
    expect(state.logged).toBeNull();
  });

  it("costs no round trip when a field is wrong", async () => {
    // The duration is checked before the project is looked up, so the common
    // mistake does not touch the database at all.
    await log({ duration: "" });

    expect(project).not.toHaveBeenCalled();
  });

  it("refuses an attribution that was never on the picker", async () => {
    const state = await log({ deliverable: "dlv_somebody_elses" });

    expect(created).not.toHaveBeenCalled();
    expect(state.errors.deliverable).toMatch(/no longer on this project/);
  });

  it("says so when the project has been deleted under the form", async () => {
    project.mockResolvedValue(null);

    const state = await log();

    expect(created).not.toHaveBeenCalled();
    expect(state.formError).toBe(TIME_PROBLEMS.missingProject);
  });

  it("keeps what was typed when the project is gone", async () => {
    project.mockResolvedValue(null);

    const state = await log({ duration: "2h", note: "Invoicing" });

    expect(state.fields.duration).toBe("2h");
    expect(state.fields.note).toBe("Invoicing");
  });

  it("reports a failed write without claiming anything was stored", async () => {
    created.mockRejectedValue(new Error("database is locked"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await log({ note: "Calls" });

    expect(state.formError).toBe(TIME_PROBLEMS.failed);
    expect(state.logged).toBeNull();
    expect(state.fields.note).toBe("Calls");
  });

  it("does not re-render the page when nothing was written", async () => {
    created.mockRejectedValue(new Error("database is locked"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await log();

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("marks an entry non-chargeable when the box was unticked", async () => {
    created.mockResolvedValue({ ...ENTRY, billable: false });

    const state = await log({ billable: "" });

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({ billable: false }),
    );
    expect(state.logged?.billable).toBe(false);
  });
});
