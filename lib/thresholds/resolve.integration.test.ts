import { beforeEach, describe, expect, it } from "vitest";

import {
  EMPTY_CLIENT_FIELDS,
  parseClientForm,
  type ClientFormFields,
} from "@/lib/clients/form";
import { createClient, updateClient } from "@/lib/data/clients";
import {
  createProject,
  getProjectWithClient,
  updateProject,
} from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import {
  EMPTY_PROJECT_FIELDS,
  parseProjectForm,
  projectFormChanges,
  type ProjectFormFields,
} from "@/lib/projects/form";

import { resolveJoinedThresholds, type ThresholdOverrides } from "./resolve";
import { THRESHOLD_SETTINGS } from "./settings";

/**
 * The chain over rows a database actually holds.
 *
 * `resolve.test.ts` says what the chain does given two objects, which is the
 * arithmetic of it. What it cannot say is that the two objects a page holds are
 * this project's and this client's: the project's settings are five columns on
 * one table, the client's are five more on another, and they arrive at
 * `resolveThresholds` through a join that has to carry both halves under
 * different names.
 *
 * So this is the whole path the project page walks — two tables, a join, and
 * the resolution — for each rung of the chain in turn. The failure it exists to
 * catch is the silent one: a project judged by Keel's defaults because the
 * client half of the join was dropped or read into the wrong argument, which
 * looks exactly like a project nobody has configured.
 */

let db: Database;

const DEFAULT_NEARLY_SPENT = THRESHOLD_SETTINGS.nearlySpentPercent.fallback;
const DEFAULT_WINDOW = THRESHOLD_SETTINGS.recentRateWindowDays.fallback;

beforeEach(async () => {
  db = await createTestDb();
});

/** A client, their project, and the settings in force on it. */
async function inForce(
  clientSettings: ThresholdOverrides = {},
  projectSettings: ThresholdOverrides = {},
) {
  const client = await createClient({ ...clientSettings, name: "Harbour Works" }, db);
  const project = await createProject(
    { ...projectSettings, clientId: client.id, name: "Engine rewrite" },
    db,
  );
  const joined = await getProjectWithClient(project.id, db);
  if (joined === null) throw new Error("the project was not read back");
  return { clientId: client.id, projectId: project.id, joined };
}

describe("the thresholds in force on a stored project", () => {
  it("are Keel's defaults when nobody has configured anything", async () => {
    const { joined } = await inForce();

    expect(resolveJoinedThresholds(joined)).toMatchObject({
      nearlySpentPercent: { value: DEFAULT_NEARLY_SPENT, source: "default" },
      recentRateWindowDays: { value: DEFAULT_WINDOW, source: "default" },
    });
  });

  it("follow the client when only the client is configured", async () => {
    const { joined } = await inForce({ nearlySpentPercent: 70 });

    expect(resolveJoinedThresholds(joined)).toMatchObject({
      nearlySpentPercent: { value: 70, source: "client" },
      // The other four are untouched by the one that was agreed.
      recentRateWindowDays: { value: DEFAULT_WINDOW, source: "default" },
    });
  });

  it("prefer the project's own figure over the client's", async () => {
    const { joined } = await inForce(
      { nearlySpentPercent: 70 },
      { nearlySpentPercent: 60 },
    );

    expect(resolveJoinedThresholds(joined)).toMatchObject({
      nearlySpentPercent: { value: 60, source: "project" },
    });
  });

  /**
   * One rung per setting, which is the arrangement the whole spec exists for: a
   * retainer's tolerance is agreed with the client, and the one job that is a
   * favour moves a single figure without moving everything else they have.
   */
  it("mix rungs across the five settings on one project", async () => {
    const { joined } = await inForce(
      { nearlySpentPercent: 70, recentRateWindowDays: 7 },
      { nearlySpentPercent: 60 },
    );

    expect(resolveJoinedThresholds(joined)).toMatchObject({
      nearlySpentPercent: { value: 60, source: "project" },
      recentRateWindowDays: { value: 7, source: "client" },
      paceShiftPercent: { source: "default" },
    });
  });

  it("fall back to the client when the project's override is cleared", async () => {
    const { projectId } = await inForce(
      { nearlySpentPercent: 70 },
      { nearlySpentPercent: 60 },
    );

    await updateProject(projectId, { nearlySpentPercent: null }, db);

    const joined = await getProjectWithClient(projectId, db);
    expect(joined === null ? null : resolveJoinedThresholds(joined)).toMatchObject(
      { nearlySpentPercent: { value: 70, source: "client" } },
    );
  });

  it("fall back to the default when the client's figure is cleared too", async () => {
    const { projectId, clientId } = await inForce({ nearlySpentPercent: 70 });

    await updateClient(clientId, { nearlySpentPercent: null }, db);

    const joined = await getProjectWithClient(projectId, db);
    expect(joined === null ? null : resolveJoinedThresholds(joined)).toMatchObject(
      { nearlySpentPercent: { value: DEFAULT_NEARLY_SPENT, source: "default" } },
    );
  });

  /**
   * Two projects for one client, one of them overriding. The expensive failure
   * is a figure that leaks: a setting typed on one engagement that quietly
   * moves the flag on everything else filed under the same client.
   */
  it("keep one project's override off the client's other projects", async () => {
    const client = await createClient(
      { name: "Harbour Works", nearlySpentPercent: 70 },
      db,
    );
    const favour = await createProject(
      { clientId: client.id, name: "A favour", nearlySpentPercent: 95 },
      db,
    );
    const retainer = await createProject(
      { clientId: client.id, name: "Retainer" },
      db,
    );

    const [one, other] = await Promise.all([
      getProjectWithClient(favour.id, db),
      getProjectWithClient(retainer.id, db),
    ]);
    if (one === null || other === null) throw new Error("a project was lost");

    expect(resolveJoinedThresholds(one).nearlySpentPercent).toEqual({
      value: 95,
      source: "project",
    });
    expect(resolveJoinedThresholds(other).nearlySpentPercent).toEqual({
      value: 70,
      source: "client",
    });
  });
});

/**
 * The same chain, entered where a person enters it: strings in a form.
 *
 * The three steps above this are the ones a page takes, and they start from
 * numbers somebody has already decided. What a reader actually does is type
 * "70" into a box, and between that and a figure in force sit the parse, the
 * column guard, the join and the resolution — four modules that each read a
 * blank box as something, and only one answer ("inherit") is right.
 *
 * The failure this catches is the one that would look like a working feature: a
 * setting typed, a form that redirects, and a project still judged by Keel's
 * default.
 */
describe("a threshold typed into a form", () => {
  /** What the client form yields for a client with one setting typed in. */
  function typedOnClient(fields: Partial<ClientFormFields>) {
    const parsed = parseClientForm({
      ...EMPTY_CLIENT_FIELDS,
      name: "Harbour Works",
      ...fields,
    });
    if (!parsed.ok) throw new Error("expected the client form to be accepted");
    return parsed.value;
  }

  /** The same for a project, which needs a client to be filed under. */
  function typedOnProject(
    clientId: string,
    fields: Partial<ProjectFormFields>,
  ) {
    const parsed = parseProjectForm(
      {
        ...EMPTY_PROJECT_FIELDS,
        client: clientId,
        name: "Engine rewrite",
        ...fields,
      },
      [clientId],
    );
    if (!parsed.ok) throw new Error("expected the project form to be accepted");
    return parsed.value;
  }

  it("reaches the figure the project is judged by", async () => {
    const client = await createClient(
      typedOnClient({ nearlySpentPercent: "70" }),
      db,
    );
    const project = await createProject(
      typedOnProject(client.id, {}),
      db,
    );

    const joined = await getProjectWithClient(project.id, db);
    expect(joined === null ? null : resolveJoinedThresholds(joined)).toMatchObject(
      { nearlySpentPercent: { value: 70, source: "client" } },
    );
  });

  it("overrides the client when the figure is typed on the project", async () => {
    const client = await createClient(
      typedOnClient({ nearlySpentPercent: "70" }),
      db,
    );
    const project = await createProject(
      typedOnProject(client.id, { nearlySpentPercent: "60" }),
      db,
    );

    const joined = await getProjectWithClient(project.id, db);
    expect(joined === null ? null : resolveJoinedThresholds(joined)).toMatchObject(
      { nearlySpentPercent: { value: 60, source: "project" } },
    );
  });

  /**
   * Clearing the box on an edit, through the patch the action builds. The
   * column has to end up NULL rather than keeping yesterday's figure, or the
   * form redirects as though the clearance stuck and the project goes on being
   * judged by a setting nothing shows.
   */
  it("goes back to the client when the box is cleared on an edit", async () => {
    const client = await createClient(
      typedOnClient({ nearlySpentPercent: "70" }),
      db,
    );
    const stored = await createProject(
      typedOnProject(client.id, { nearlySpentPercent: "60" }),
      db,
    );

    const cleared = typedOnProject(client.id, { nearlySpentPercent: "" });
    await updateProject(stored.id, projectFormChanges(stored, cleared), db);

    const joined = await getProjectWithClient(stored.id, db);
    expect(joined === null ? null : resolveJoinedThresholds(joined)).toMatchObject(
      { nearlySpentPercent: { value: 70, source: "client" } },
    );
  });

  it("never reaches a column with a figure the form refuses", async () => {
    const refused = parseClientForm({
      ...EMPTY_CLIENT_FIELDS,
      name: "Harbour Works",
      nearlySpentPercent: "400",
    });

    expect(refused.ok).toBe(false);
  });
});
