import { describe, expect, it, vi } from "vitest";
import { loadBest, loadSettings, saveBest, saveSettings } from "./persist.js";

describe("Playgrounds KV persistence", () => {
  it("loads the best vote record from lixuan:best", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, text: async () => "1288" }));
    await expect(loadBest(fetcher)).resolves.toBe(1288);
    expect(fetcher).toHaveBeenCalledWith("/api/kv/lixuan:best");
  });

  it("only writes a better result and remains playable offline", async () => {
    const fetcher = vi.fn(async () => ({ ok: true }));
    await expect(saveBest(900, 1000, fetcher)).resolves.toBe(1000);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(saveBest(1200, 1000, fetcher)).resolves.toBe(1200);
    expect(fetcher).toHaveBeenCalledWith("/api/kv/lixuan:best", {
      method: "PUT",
      body: "1200",
    });
  });

  it("loads and saves sound settings through lixuan:settings", async () => {
    const reader = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ sound: false }),
    }));
    await expect(loadSettings(reader)).resolves.toEqual({ sound: false });
    const writer = vi.fn(async () => ({ ok: true }));
    await saveSettings({ sound: true }, writer);
    expect(writer).toHaveBeenCalledWith("/api/kv/lixuan:settings", {
      method: "PUT",
      body: JSON.stringify({ sound: true }),
    });
  });
});
