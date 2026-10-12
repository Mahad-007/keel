import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  importDeliverables,
  listDeliverables,
} from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { formatMinutes } from "@/lib/minutes";
import { summariseScope } from "@/lib/scope";

import { IMPORT_NOTES, importSizePhrase, previewImport } from "./import";

/**
 * The promise the preview makes, end to end: what the table says is what
 * lands.
 *
 * Both halves are tested on their own where they live — the parser without a
 * database, the write without a parse. This is the seam between them, and it
 * is the one a reader is relying on when they press Import: they have read a
 * table of a dozen lines and are agreeing to those lines, so a paste that
 * imported something slightly different would make the preview worse than no
 * preview at all.
 */

let db: Database;
let projectId: string;

beforeEach(async () => {
  db = await createTestDb();
  const clientId = (await createClient({ name: "Anvil Co" }, db)).id;
  projectId = (
    await createProject(
      { clientId, name: "Site rebuild", contractValueCents: 1_000_000 },
      db,
    )
  ).id;
});

/** A paste of the kind that arrives out of a proposal. */
const PASTE = [
  "Discovery workshop | 4",
  "Information architecture\t6",
  "Wireframes | 12",
  "",
  "Visual design | 20",
  "Build",
].join("\n");

async function importPaste(text: string) {
  const preview = previewImport(
    text,
    (await listDeliverables(projectId, db)).map((row) => row.title),
  );
  const result = await importDeliverables(projectId, preview.drafts, db);
  return { preview, result };
}

describe("a pasted scope list, previewed and then imported", () => {
  it("writes exactly the lines the preview showed", async () => {
    const { preview, result } = await importPaste(PASTE);

    if (!result.ok) throw new Error("expected the paste to be imported");
    expect(
      result.deliverables.map((row) => ({
        title: row.title,
        estimatedMinutes: row.estimatedMinutes,
      })),
    ).toEqual(preview.drafts);
  });

  it("leaves the stored list reading in the order it was pasted", async () => {
    await importPaste(PASTE);

    expect((await listDeliverables(projectId, db)).map((row) => row.title)).toEqual([
      "Discovery workshop",
      "Information architecture",
      "Wireframes",
      "Visual design",
      "Build",
    ]);
  });

  it("totals on the scope panel what the preview said it would add", async () => {
    const { preview } = await importPaste(PASTE);

    const summary = summariseScope(
      await listDeliverables(projectId, db),
      1_000_000,
    );
    expect(importSizePhrase(preview.drafts)).toBe(
      `5 deliverables and ${formatMinutes(summary.estimatedMinutes)}, with 1 not estimated`,
    );
  });

  it("counts the unsized line as unsized on the panel as well", async () => {
    await importPaste(PASTE);

    const summary = summariseScope(
      await listDeliverables(projectId, db),
      1_000_000,
    );
    expect(summary.unestimatedCount).toBe(1);
  });

  it("keeps the positions dense from zero", async () => {
    await importPaste(PASTE);

    expect(
      (await listDeliverables(projectId, db)).map((row) => row.sortOrder),
    ).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("a second paste onto a list that has already been imported", () => {
  it("remarks on every line the first paste already agreed", async () => {
    await importPaste(PASTE);

    const { preview } = await importPaste("Wireframes | 12\nSitemap | 2");

    expect(preview.lines[0]).toMatchObject({
      ok: true,
      note: IMPORT_NOTES.agreed,
    });
    expect(preview.lines[1]).toMatchObject({ ok: true, note: null });
  });

  it("adds the lines anyway, because a list may say a thing twice", async () => {
    await importPaste(PASTE);
    await importPaste("Wireframes | 12");

    const titles = (await listDeliverables(projectId, db)).map(
      (row) => row.title,
    );
    expect(titles.filter((title) => title === "Wireframes")).toHaveLength(2);
  });

  it("appends to the end rather than replacing what was agreed", async () => {
    await importPaste(PASTE);
    await importPaste("Sitemap | 2");

    const list = await listDeliverables(projectId, db);
    expect(list).toHaveLength(6);
    expect(list[5].title).toBe("Sitemap");
    expect(list.map((row) => row.sortOrder)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
