import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTimeEntry, updateTimeEntry } from "@/lib/data/time-entries";
import { projectPath } from "@/lib/projects/detail";
import type { AttributableDeliverable } from "@/lib/time/attribution";
import { editTimeState, EDIT_TIME_PROBLEMS } from "@/lib/time/edit";
import { BILLABLE_VALUE } from "@/lib/time/form";

import { writeTimeEntryEdit } from "./time-writes";

/**
 * Mocked collaborators rather than a database: this function's own job is the
 * branching — reject, refuse, no-op, write — and the validation and the update
 * are each already tested where they live.
 */
vi.mock("@/lib/data/deliverables", () => ({ getDeliverable: vi.fn() }));
vi.mock("@/lib/data/projects", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/data/time-entries", () => ({
  createTimeEntry: vi.fn(),
  deleteTimeEntry: vi.fn(),
  getTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const read = vi.mocked(getTimeEntry);
const saved = vi.mocked(updateTimeEntry);
const revalidated = vi.mocked(revalidatePath);

const OFFERED: AttributableDeliverable[] = [
  { id: "dlv_wireframes", title: "Wireframes", estimatedMinutes: 360 },
  { id: "dlv_build", title: "Build", estimatedMinutes: 0 },
];

const ENTRY = {
  id: "tme_1",
  projectId: "prj_engine",
  deliverableId: "dlv_wireframes",
  minutes: 90,
  note: "Booking flow",
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

/** The form as it opens on ENTRY, with whatever the reader changed. */
function edit(values: Record<string, string> = {}) {
  return writeTimeEntryEdit(
    "prj_engine",
    OFFERED,
    editTimeState(ENTRY),
    submit({
      id: "tme_1",
      duration: "1h 30m",
      workedOn: "2026-10-17",
      deliverable: "dlv_wireframes",
      note: "Booking flow",
      billable: BILLABLE_VALUE,
      ...values,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue(ENTRY);
  saved.mockImplementation(async (_id, patch) => ({
    ok: true,
    entry: { ...ENTRY, ...patch },
  }));
});

describe("saving a change to one entry", () => {
  it("patches only the column that moved", async () => {
    await edit({ duration: "2h" });
    expect(saved).toHaveBeenCalledWith("tme_1", { minutes: 120 });
  });

  it("re-attributes the entry to another offered line", async () => {
    await edit({ deliverable: "dlv_build" });
    expect(saved).toHaveBeenCalledWith("tme_1", {
      deliverableId: "dlv_build",
    });
  });

  it("takes an attribution off onto the project itself", async () => {
    await edit({ deliverable: "" });
    expect(saved).toHaveBeenCalledWith("tme_1", { deliverableId: null });
  });

  it("unticks the chargeable flag when the box comes back empty", async () => {
    await edit({ billable: "" });
    expect(saved).toHaveBeenCalledWith("tme_1", { billable: false });
  });

  it("re-renders the page, which is where the row is read from", async () => {
    await edit({ duration: "2h" });
    expect(revalidated).toHaveBeenCalledWith(projectPath("prj_engine"));
  });

  it("names the entry as saved rather than as it was", async () => {
    const state = await edit({ duration: "2h" });
    expect(state.saved).toEqual({
      id: "tme_1",
      name: '2h on Oct 17, 2026 against “Wireframes”, Booking flow',
      changed: true,
    });
  });

  it("hands back the row as written, not what was typed", async () => {
    const state = await edit({ note: "  Booking flow and invoices  " });
    expect(state.fields.note).toBe("Booking flow and invoices");
  });
});

describe("a form opened and saved untouched", () => {
  it("writes nothing, so the entry does not look edited today", async () => {
    const state = await edit();

    expect(saved).not.toHaveBeenCalled();
    expect(state.saved).toEqual({
      id: "tme_1",
      name: '1h 30m on Oct 17, 2026 against “Wireframes”, Booking flow',
      changed: false,
    });
  });

  it("leaves the page alone, because nothing about it changed", async () => {
    await edit();
    expect(revalidated).not.toHaveBeenCalled();
  });

  it("closes the row all the same, having nothing left to say", async () => {
    const state = await edit();
    expect(state.saved?.changed).toBe(false);
    expect(state.formError).toBeNull();
  });
});

describe("a submission validation refuses", () => {
  it("keeps what was typed and names the bad field", async () => {
    const state = await edit({ duration: "1:30" });

    expect(saved).not.toHaveBeenCalled();
    expect(state.fields.duration).toBe("1:30");
    expect(state.errors.duration).toMatch(/clock reading/);
    expect(state.saved).toBeNull();
  });

  it("refuses an attribution to a line this page did not offer", async () => {
    const state = await edit({ deliverable: "dlv_elsewhere" });

    expect(saved).not.toHaveBeenCalled();
    expect(state.errors.deliverable).toMatch(/no longer on this project/);
  });

  it("does not read the entry for a submission it already refused", async () => {
    await edit({ duration: "" });
    expect(read).not.toHaveBeenCalled();
  });
});

describe("an entry this page is not showing", () => {
  it("refuses one belonging to another project", async () => {
    read.mockResolvedValue({ ...ENTRY, projectId: "prj_other" });

    const state = await edit({ duration: "2h" });

    expect(saved).not.toHaveBeenCalled();
    expect(state.formError).toBe(EDIT_TIME_PROBLEMS.missing);
  });

  it("refuses an id no entry has", async () => {
    read.mockResolvedValue(null);
    const state = await edit({ duration: "2h" });
    expect(state.formError).toBe(EDIT_TIME_PROBLEMS.missing);
  });

  it("refuses a submission that names no entry", async () => {
    const state = await edit({ id: "" });

    expect(read).not.toHaveBeenCalled();
    expect(state.formError).toBe(EDIT_TIME_PROBLEMS.missing);
  });
});

describe("an entry an invoice has billed", () => {
  it("refuses the save before reaching the write", async () => {
    read.mockResolvedValue({ ...ENTRY, billedInvoiceId: "inv_7" });

    const state = await edit({ duration: "2h" });

    expect(saved).not.toHaveBeenCalled();
    expect(state.formError).toBe(EDIT_TIME_PROBLEMS.billed);
  });

  it("refuses a save that only touches the note", async () => {
    // The data layer would allow it. A form that accepts one field out of five
    // and refuses the rest is a form that looks broken.
    read.mockResolvedValue({ ...ENTRY, billedInvoiceId: "inv_7" });

    const state = await edit({ note: "Corrected typo" });

    expect(saved).not.toHaveBeenCalled();
    expect(state.formError).toBe(EDIT_TIME_PROBLEMS.billed);
  });
});

describe("something that changed while the form sat open", () => {
  it("says the entry has gone", async () => {
    saved.mockResolvedValue({ ok: false, refusal: "no-such-entry" });
    const state = await edit({ duration: "2h" });
    expect(state.formError).toBe(EDIT_TIME_PROBLEMS.missing);
  });

  it("says which line of scope was dropped under it", async () => {
    saved.mockResolvedValue({ ok: false, refusal: "no-such-deliverable" });
    const state = await edit({ deliverable: "dlv_build" });
    expect(state.formError).toBe(EDIT_TIME_PROBLEMS.missingDeliverable);
  });

  it("says an invoice got there first", async () => {
    saved.mockResolvedValue({ ok: false, refusal: "billed" });
    const state = await edit({ duration: "2h" });
    expect(state.formError).toBe(EDIT_TIME_PROBLEMS.billed);
  });

  it("leaves the page alone for any of them", async () => {
    saved.mockResolvedValue({ ok: false, refusal: "billed" });
    await edit({ duration: "2h" });
    expect(revalidated).not.toHaveBeenCalled();
  });
});

describe("a save the driver refused", () => {
  it("tells the reader nothing was written and to try again", async () => {
    saved.mockRejectedValue(new Error("database is locked"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await edit({ duration: "2h" });

    expect(state.formError).toBe(EDIT_TIME_PROBLEMS.failed);
    expect(state.fields.duration).toBe("2h");
    expect(revalidated).not.toHaveBeenCalled();
  });
});
