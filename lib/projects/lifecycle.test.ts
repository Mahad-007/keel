import { describe, expect, it } from "vitest";

import { lifecycleStamps, type ProjectLifecycle } from "./lifecycle";

const DRAFT: ProjectLifecycle = {
  status: "draft",
  startedAt: null,
  closedAt: null,
};

const NOW = "2026-09-24T10:00:00.000Z";
const EARLIER = "2026-03-01T09:00:00.000Z";

describe("lifecycleStamps on activation", () => {
  it("stamps the start the first time a project goes active", () => {
    expect(lifecycleStamps(DRAFT, "active", NOW)).toEqual({
      startedAt: NOW,
      closedAt: null,
    });
  });

  it("keeps the original start when a project is activated again", () => {
    const paused: ProjectLifecycle = {
      status: "paused",
      startedAt: EARLIER,
      closedAt: null,
    };

    expect(lifecycleStamps(paused, "active", NOW).startedAt).toBe(EARLIER);
  });

  it("does not rewrite the start when the status is unchanged", () => {
    const active: ProjectLifecycle = {
      status: "active",
      startedAt: EARLIER,
      closedAt: null,
    };

    expect(lifecycleStamps(active, "active", NOW).startedAt).toBe(EARLIER);
  });
});

describe("lifecycleStamps on pausing", () => {
  it("leaves the start alone when a running project pauses", () => {
    const active: ProjectLifecycle = {
      status: "active",
      startedAt: EARLIER,
      closedAt: null,
    };

    expect(lifecycleStamps(active, "paused", NOW)).toEqual({
      startedAt: EARLIER,
      closedAt: null,
    });
  });

  it("does not invent a start for a draft that was never active", () => {
    expect(lifecycleStamps(DRAFT, "paused", NOW).startedAt).toBeNull();
  });
});

describe("lifecycleStamps on closing", () => {
  it("stamps the close when a running project closes", () => {
    const active: ProjectLifecycle = {
      status: "active",
      startedAt: EARLIER,
      closedAt: null,
    };

    expect(lifecycleStamps(active, "closed", NOW)).toEqual({
      startedAt: EARLIER,
      closedAt: NOW,
    });
  });

  it("keeps the first close time when an already-closed project is re-closed", () => {
    const closed: ProjectLifecycle = {
      status: "closed",
      startedAt: EARLIER,
      closedAt: EARLIER,
    };

    expect(lifecycleStamps(closed, "closed", NOW).closedAt).toBe(EARLIER);
  });

  it("closes a draft that never ran without giving it a start date", () => {
    expect(lifecycleStamps(DRAFT, "closed", NOW)).toEqual({
      startedAt: null,
      closedAt: NOW,
    });
  });

  it("stamps a close for a closed row that somehow has no close time", () => {
    const closed: ProjectLifecycle = {
      status: "closed",
      startedAt: EARLIER,
      closedAt: null,
    };

    expect(lifecycleStamps(closed, "closed", NOW).closedAt).toBe(NOW);
  });
});

describe("lifecycleStamps on reopening", () => {
  it("clears the close when a closed project goes active again", () => {
    const closed: ProjectLifecycle = {
      status: "closed",
      startedAt: EARLIER,
      closedAt: EARLIER,
    };

    expect(lifecycleStamps(closed, "active", NOW)).toEqual({
      startedAt: EARLIER,
      closedAt: null,
    });
  });

  it("clears the close when a closed project is parked as paused", () => {
    const closed: ProjectLifecycle = {
      status: "closed",
      startedAt: EARLIER,
      closedAt: EARLIER,
    };

    expect(lifecycleStamps(closed, "paused", NOW).closedAt).toBeNull();
  });
});

describe("lifecycleStamps on returning to draft", () => {
  it("clears both stamps, because a draft has not happened yet", () => {
    const closed: ProjectLifecycle = {
      status: "closed",
      startedAt: EARLIER,
      closedAt: NOW,
    };

    expect(lifecycleStamps(closed, "draft", NOW)).toEqual({
      startedAt: null,
      closedAt: null,
    });
  });

  it("leaves an untouched draft untouched", () => {
    expect(lifecycleStamps(DRAFT, "draft", NOW)).toEqual({
      startedAt: null,
      closedAt: null,
    });
  });
});
