import { describe, expect, it } from "vitest";

import { CLIENTS_PATH, clientEditPath, clientPath } from "./detail";

describe("clientPath", () => {
  it("hangs the client off the client book", () => {
    expect(clientPath("cli_1")).toBe(`${CLIENTS_PATH}/cli_1`);
  });

  it("escapes an id that would otherwise change the path", () => {
    expect(clientPath("cli/1?x")).toBe(`${CLIENTS_PATH}/cli%2F1%3Fx`);
  });
});

describe("clientEditPath", () => {
  it("is the client's own path with the form on the end", () => {
    expect(clientEditPath("cli_1")).toBe("/clients/cli_1/edit");
  });

  it("escapes the id once, through the client's path", () => {
    expect(clientEditPath("cli 1")).toBe("/clients/cli%201/edit");
  });
});
