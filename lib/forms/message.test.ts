import { describe, expect, it } from "vitest";

import { readableMessage } from "./message";

describe("readableMessage", () => {
  it("keeps a real message", () => {
    expect(readableMessage("Name is required.")).toBe("Name is required.");
  });

  it("trims the whitespace around it", () => {
    expect(readableMessage("  Name is required.\n")).toBe("Name is required.");
  });

  it("treats an absent message as nothing to say", () => {
    expect(readableMessage(undefined)).toBeNull();
  });

  it("treats an empty message as nothing to say", () => {
    expect(readableMessage("")).toBeNull();
  });

  it("treats a whitespace-only message as nothing to say", () => {
    expect(readableMessage("  \t\n ")).toBeNull();
  });
});
