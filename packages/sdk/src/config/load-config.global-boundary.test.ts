import { describe, expect, it, vi } from "vitest";
import { baseConfig, makeTempDir } from "../test-support.js";
import { loadConfig } from "./load-config.js";

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));

vi.mock("cosmiconfig", () => ({
  cosmiconfig: () => ({ search: searchMock, load: vi.fn() }),
}));

describe("loadConfig: rejects a search result outside the cwd-to-stopDir chain", () => {
  it("rejects a config found in cosmiconfig's OS-level global config directory as CONFIG_NOT_FOUND", async () => {
    const dir = await makeTempDir();
    searchMock.mockResolvedValueOnce({
      config: baseConfig(),
      filepath: "/an/unrelated/global-config-dir/config.json",
      isEmpty: false,
    });

    await expect(loadConfig({ cwd: dir })).rejects.toMatchObject({ code: "CONFIG_NOT_FOUND" });
  });

  it("still accepts a search result whose directory is within the search chain", async () => {
    const dir = await makeTempDir();
    searchMock.mockResolvedValueOnce({
      config: baseConfig({ sourceLocale: "en" }),
      filepath: `${dir}/.verbatrarc.json`,
      isEmpty: false,
    });

    const config = await loadConfig({ cwd: dir });

    expect(config.sourceLocale).toBe("en");
  });
});
