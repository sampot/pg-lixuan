const BEST_URL = "/api/kv/lixuan:best";
const SETTINGS_URL = "/api/kv/lixuan:settings";

export async function loadBest(fetcher = fetch) {
  try {
    const response = await fetcher(BEST_URL);
    if (!response.ok) return 0;
    const value = Number(await response.text());
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export async function saveBest(score, currentBest, fetcher = fetch) {
  const nextBest = Math.max(score, currentBest);
  if (nextBest <= currentBest) return currentBest;
  try {
    await fetcher(BEST_URL, { method: "PUT", body: String(nextBest) });
  } catch {
    // Static previews do not provide the host KV API.
  }
  return nextBest;
}

export async function loadSettings(fetcher = fetch) {
  try {
    const response = await fetcher(SETTINGS_URL);
    if (!response.ok) return { sound: true };
    const parsed = JSON.parse(await response.text());
    return { sound: parsed.sound !== false };
  } catch {
    return { sound: true };
  }
}

export async function saveSettings(settings, fetcher = fetch) {
  const safe = { sound: settings.sound !== false };
  try {
    await fetcher(SETTINGS_URL, {
      method: "PUT",
      body: JSON.stringify(safe),
    });
  } catch {
    // Settings are optional when the game is served without Playgrounds.
  }
  return safe;
}
