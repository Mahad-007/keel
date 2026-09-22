import { describe, expect, it } from "vitest";

import { parseProgress } from "./progress";

const SAMPLE = `# Roadmap

Some prose that mentions - [ ] nothing parseable.

## Phase 1

- [x] **Day 001** — Client data layer. More detail here.
- [x] **Day 002** — Clients list page at \`/clients\`: server component.
- [ ] **Day 003** — Shared form primitives. Retrofit the forms.
- [ ] **Day 004** — Projects table.
`;

describe("parseProgress", () => {
  it("counts checked and total milestones", () => {
    const p = parseProgress(SAMPLE);
    expect(p.done).toBe(2);
    expect(p.total).toBe(4);
  });

  it("reports the first unchecked milestone", () => {
    expect(parseProgress(SAMPLE).next).toEqual({
      label: "Day 003",
      summary: "Shared form primitives",
    });
  });

  it("returns no next milestone once everything is checked", () => {
    const p = parseProgress("- [x] **Day 001** — Done.\n");
    expect(p).toEqual({ done: 1, total: 1, next: null });
  });

  it("finds nothing in markdown with no milestones", () => {
    expect(parseProgress("# Just a heading\n")).toEqual({
      done: 0,
      total: 0,
      next: null,
    });
  });
});
