import { describe, expect, it } from "vitest";

import type { Client } from "@/lib/db/schema";

import { clientOptionLabel } from "./options";

function client(fields: Partial<Client> = {}): Client {
  return {
    id: "cli_ada",
    name: "Ada Lovelace",
    email: null,
    company: null,
    notes: null,
    defaultRateCents: 0,
    archivedAt: null,
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
    ...fields,
  };
}

describe("clientOptionLabel", () => {
  it("is the client's name when that is all there is", () => {
    expect(clientOptionLabel(client())).toBe("Ada Lovelace");
  });

  it("adds the company, which is what tells two people apart", () => {
    expect(clientOptionLabel(client({ company: "Analytical Engines" }))).toBe(
      "Ada Lovelace — Analytical Engines",
    );
  });

  it("does not say the same thing twice", () => {
    const sole = client({ name: "Analytical Engines", company: "Analytical Engines" });
    expect(clientOptionLabel(sole)).toBe("Analytical Engines");
  });

  it("ignores a company of nothing but whitespace", () => {
    expect(clientOptionLabel(client({ company: "   " }))).toBe("Ada Lovelace");
  });
});
