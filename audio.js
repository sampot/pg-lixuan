const EFFECTS = {
  click: "./assets/audio/click.ogg",
  success: "./assets/audio/success.ogg",
  hover: "./assets/audio/hover.ogg",
};

export class CampaignAudio {
  constructor() {
    this.enabled = true;
    this.started = false;
    this.music = new Audio("./assets/audio/campaign-loop.ogg");
    this.music.loop = true;
    this.music.volume = 0.16;
    this.effects = Object.fromEntries(
      Object.entries(EFFECTS).map(([name, path]) => {
        const audio = new Audio(path);
        audio.volume = name === "success" ? 0.48 : 0.34;
        return [name, audio];
      }),
    );
  }

  async start() {
    this.started = true;
    if (!this.enabled) return;
    try {
      await this.music.play();
    } catch {
      // Browsers may wait for the next explicit interaction.
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.music.pause();
    else if (this.started) void this.start();
  }

  play(name) {
    const effect = this.effects[name];
    if (!this.enabled || !effect) return;
    effect.currentTime = 0;
    void effect.play().catch(() => {});
  }
}
