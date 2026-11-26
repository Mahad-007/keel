import { beforeEach, describe, expect, it } from "vitest";

import { createClient, updateClient } from "@/lib/data/clients";
import {
  createProject,
  getProjectWithClient,
  updateProject,
} from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

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
