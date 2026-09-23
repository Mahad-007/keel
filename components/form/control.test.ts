import { describe, expect, it } from "vitest";

import { controlClassName } from "./control";

describe("controlClassName", () => {
  it("gives a valid and an invalid control the same box", () => {
    const shared = controlClassName(false)
      .split(" ")
      .filter((name) => controlClassName(true).split(" ").includes(name));

    expect(shared).toContain("rounded");
    expect(shared).toContain("px-2.5");
    expect(shared).toContain("text-sm");
  });

  it("marks an invalid control out from a valid one", () => {
    expect(controlClassName(true)).not.toBe(controlClassName(false));
  });

  it("does not leave a valid control wearing the invalid border", () => {
    expect(controlClassName(false)).not.toMatch(/border-red/);
    expect(controlClassName(true)).toMatch(/border-red/);
  });
});
