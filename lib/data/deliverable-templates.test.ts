import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import {
  createDeliverableTemplate,
  getDeliverableTemplate,
  listTemplateLines,
} from "./deliverable-templates";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

const LINES = [
  { title: "Discovery", description: "Two workshops.", estimatedMinutes: 480 },
  { title: "Build", description: null, estimatedMinutes: 2_400 },
];

describe("createDeliverableTemplate", () => {
  it("stores the template and hands back the saved row", async () => {
    const template = await createDeliverableTemplate(
      { name: "Website build", description: "The usual.", lines: LINES },
      db,
    );

    expect(template.id).toMatch(/^tpl_/);
    expect(template.name).toBe("Website build");
    expect(template.description).toBe("The usual.");
  });

  it("writes the lines in the order they were given, dense from zero", async () => {
    const template = await createDeliverableTemplate(
      { name: "Website build", lines: LINES },
      db,
    );

    const lines = await listTemplateLines(template.id, db);
    expect(lines.map((line) => line.title)).toEqual(["Discovery", "Build"]);
    expect(lines.map((line) => line.sortOrder)).toEqual([0, 1]);
    expect(lines[0].id).toMatch(/^tln_/);
  });

  it("carries the detail and the estimate onto each line", async () => {
    const template = await createDeliverableTemplate(
      { name: "Website build", lines: LINES },
      db,
    );

    const [first, second] = await listTemplateLines(template.id, db);
    expect(first.description).toBe("Two workshops.");
    expect(first.estimatedMinutes).toBe(480);
    expect(second.description).toBeNull();
    expect(second.estimatedMinutes).toBe(2_400);
  });

  it("collapses a blank description to NULL rather than storing spaces", async () => {
    const template = await createDeliverableTemplate(
      { name: "Website build", description: "   ", lines: LINES },
      db,
    );

    expect(template.description).toBeNull();
  });

  it("trims the name", async () => {
    const template = await createDeliverableTemplate(
      { name: "  Retainer month  ", lines: LINES },
      db,
    );

    expect(template.name).toBe("Retainer month");
  });

  it("refuses a template with no lines on it", async () => {
    await expect(
      createDeliverableTemplate({ name: "Empty", lines: [] }, db),
    ).rejects.toThrow(/at least one deliverable/);
  });

  it("refuses a template with no name", async () => {
    await expect(
      createDeliverableTemplate({ name: "   ", lines: LINES }, db),
    ).rejects.toThrow(/template name is required/);
  });

  it("refuses a line with no title", async () => {
    await expect(
      createDeliverableTemplate(
        {
          name: "Website build",
          lines: [{ title: " ", description: null, estimatedMinutes: 0 }],
        },
        db,
      ),
    ).rejects.toThrow(/template line title is required/);
  });

  it("refuses a fractional estimate", async () => {
    await expect(
      createDeliverableTemplate(
        {
          name: "Website build",
          lines: [{ title: "Build", description: null, estimatedMinutes: 1.5 }],
        },
        db,
      ),
    ).rejects.toThrow(/whole minutes/);
  });

  it("writes nothing at all when one line is bad", async () => {
    await expect(
      createDeliverableTemplate(
        {
          name: "Website build",
          lines: [
            { title: "Discovery", description: null, estimatedMinutes: 480 },
            { title: "", description: null, estimatedMinutes: 0 },
          ],
        },
        db,
      ),
    ).rejects.toThrow();

    const rows = await db.query.deliverableTemplates.findMany();
    expect(rows).toEqual([]);
  });
});

describe("getDeliverableTemplate", () => {
  it("reads back a template by id", async () => {
    const saved = await createDeliverableTemplate(
      { name: "Website build", lines: LINES },
      db,
    );

    expect(await getDeliverableTemplate(saved.id, db)).toEqual(saved);
  });

  it("answers null for an id that is not a template", async () => {
    expect(await getDeliverableTemplate("tpl_nope", db)).toBeNull();
  });
});

describe("listTemplateLines", () => {
  it("reads only the lines of the template asked for", async () => {
    const website = await createDeliverableTemplate(
      { name: "Website build", lines: LINES },
      db,
    );
    await createDeliverableTemplate(
      {
        name: "Retainer month",
        lines: [{ title: "Support", description: null, estimatedMinutes: 600 }],
      },
      db,
    );

    const lines = await listTemplateLines(website.id, db);
    expect(lines.map((line) => line.title)).toEqual(["Discovery", "Build"]);
  });

  it("answers with nothing for a template that does not exist", async () => {
    expect(await listTemplateLines("tpl_nope", db)).toEqual([]);
  });
});
