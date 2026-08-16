import { CampaignAudio } from "./audio.js";
import { ISSUES, applyAction, createGame, pollFor, resolveWeek } from "./game.js";
import { loadBest, loadSettings, saveBest, saveSettings } from "./persist.js";

const $ = (selector) => document.querySelector(selector);
const audio = new CampaignAudio();
const issueEmoji = { traffic: "🚦", security: "🛡️", environment: "🌱", eldercare: "🫶" };
const candidateColors = { player: "#f36f56", "ai-care": "#178e83", "ai-build": "#6750a4" };

let game = null;
let selectedNeighborhood = "market";
let selectedIssue = "traffic";
let best = 0;
let settings = { sound: true };

function renderHud() {
  const player = game.candidates[0];
  $("#week-value").textContent = `${game.week} / ${game.maxWeeks}`;
  $("#ap-value").textContent = `${"●".repeat(game.actionPoints)}${"○".repeat(4 - game.actionPoints)}`;
  $("#volunteer-value").textContent = String(player.volunteers);
  $("#budget-value").textContent = `$${player.budget}`;
  $("#trust-value").textContent = player.trust.toFixed(1);
}

function renderEvent() {
  const card = $("#event-card");
  const event = game.pendingEvent;
  card.classList.toggle("alert", Boolean(event));
  card.querySelector("img").src = event ? "./assets/images/question.png" : "./assets/images/happy.png";
  $("#event-title").textContent = event
    ? event.type === "rumor" ? "社群傳言正在流動" : "活動支出引起討論"
    : game.week === 4 ? "投票週到了" : "社區持續觀察";
  $("#event-copy").textContent = event
    ? "用「澄清」公開資料與過程，不必攻擊其他候選人。"
    : game.week === 4 ? "催票能提高支持者投票意願，但低信任無法一夕翻盤。" : "居民會比較誰真正回應地方需求。";
}

function renderNeighborhoods() {
  $("#neighborhoods").innerHTML = game.neighborhoods.map((neighborhood) => `
    <button type="button" class="neighborhood ${neighborhood.id === selectedNeighborhood ? "selected" : ""}"
      data-neighborhood="${neighborhood.id}" role="radio"
      aria-checked="${neighborhood.id === selectedNeighborhood}">
      <strong>${neighborhood.name}</strong>
      <small>${neighborhood.issues.map((issue) => `${issueEmoji[issue]} ${ISSUES[issue]}`).join(" ・ ")}</small>
      <small>${neighborhood.population.toLocaleString("zh-TW")} 位選民</small>
    </button>
  `).join("");
  document.querySelectorAll("[data-neighborhood]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedNeighborhood = button.dataset.neighborhood;
      $("#target-label").textContent = game.neighborhoods.find((n) => n.id === selectedNeighborhood).name;
      audio.play("click");
      renderNeighborhoods();
    });
  });
}

function renderActions() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    const action = button.dataset.action;
    button.disabled =
      game.actionPoints === 0 ||
      game.phase !== "campaign" ||
      (action === "gotv" && game.week !== 4);
  });
  $("#end-week").textContent = game.week === 4 ? "結束競選・正式開票" : `結束第 ${game.week} 週・看民調`;
}

function renderPolls() {
  $("#poll-list").innerHTML = game.neighborhoods.map((neighborhood) => {
    const poll = pollFor(game, neighborhood.id);
    return `
      <article class="poll-card">
        <h3>${neighborhood.name}</h3>
        ${poll.candidates.map((entry) => `
          <div class="poll-row">
            <span>${entry.id === "player" ? "你" : entry.name.split("・")[0]}</span>
            <span class="poll-track"><i style="--bar:${candidateColors[entry.id]};width:${(entry.low + entry.high) / 2}%"></i></span>
            <strong>${entry.low}–${entry.high}</strong>
          </div>
        `).join("")}
      </article>
    `;
  }).join("");
}

function renderLog() {
  $("#log-list").innerHTML = game.log.map((entry) => `<li>${entry}</li>`).join("");
}

function renderGame() {
  renderHud();
  renderEvent();
  renderNeighborhoods();
  renderActions();
  renderPolls();
  renderLog();
}

function showStatus(message, error = false) {
  const status = $("#action-status");
  status.textContent = message;
  status.classList.toggle("error", error);
}

function takeAction(type) {
  try {
    game = applyAction(game, {
      type,
      neighborhoodId: selectedNeighborhood,
      issue: selectedIssue,
    });
    globalThis.__lixuan = { getGame: () => game };
    showStatus(game.log[0]);
    audio.play(type === "petition" || type === "clarify" ? "success" : "click");
    renderGame();
  } catch (error) {
    showStatus(error.message, true);
    audio.play("hover");
  }
}

function resultRows(ranking) {
  return ranking.map((entry) => `
    <div class="result-row ${entry.id === "player" ? "player" : ""}">
      <span>${entry.place === 1 ? "🏅" : `#${entry.place}`}</span>
      <span><strong>${entry.name}</strong><small>${entry.id === "player" ? "你的得票" : "對手得票"}</small></span>
      <strong>${entry.votes.toLocaleString("zh-TW")} 票</strong>
    </div>
  `).join("");
}

async function showWeekResult(completedWeek) {
  const sheet = $("#week-sheet");
  const ended = game.phase === "ended";
  $("#week-kicker").textContent = ended ? "開票所全數回報" : `第 ${completedWeek} 週結束`;
  if (ended) {
    const player = game.finalResult.ranking.find((entry) => entry.id === "player");
    const won = game.finalResult.winners.some((entry) => entry.id === "player");
    best = await saveBest(player.votes, best);
    $("#best-value").textContent = best.toLocaleString("zh-TW");
    $("#week-title").textContent = won
      ? game.finalResult.winners.length > 1 ? "同票並列第一！" : "當選！里民把未來交給你"
      : `這次是第 ${player.place} 名`;
    $("#week-content").innerHTML = `
      <div class="confetti">${won ? "🎊 🗳️ 🎊" : "🌱 🤝 🌱"}</div>
      <p>${won ? "勝選不是句點。你承諾要把競選時聽見的小事，一件件帶進里務。" : "社區工作不只在選舉。整理居民意見，下次用更穩定的服務累積信任。"}</p>
      <div class="result-ranking">${resultRows(game.finalResult.ranking)}</div>
      <p>全里共開出 <strong>${game.finalResult.totalVotes.toLocaleString("zh-TW")}</strong> 票。</p>
    `;
    $("#week-continue").textContent = "回競選總部・再來一局";
    audio.play(won ? "success" : "hover");
  } else {
    $("#week-title").textContent = `進入第 ${game.week} 週`;
    $("#week-content").innerHTML = `
      <p>${game.pendingEvent ? "社區出現新的討論，先看總部快報再安排回應。" : "這週沒有大型風波。兩位對手也完成了各自行程。"}</p>
      <p>新的一週補進 1 位志工；民調仍是帶有誤差的觀察區間。</p>
    `;
    $("#week-continue").textContent = "回到社區排行程";
    audio.play("success");
  }
  sheet.hidden = false;
  $("#week-continue").focus();
}

document.querySelectorAll("[data-issue]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedIssue = button.dataset.issue;
    document.querySelectorAll("[data-issue]").forEach((item) => item.classList.toggle("selected", item === button));
    audio.play("click");
  });
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => takeAction(button.dataset.action));
  button.addEventListener("pointerenter", () => audio.play("hover"));
});

$("#start-button").addEventListener("click", async () => {
  await audio.start();
  audio.play("success");
  game = createGame({ seed: Date.now() });
  selectedNeighborhood = "market";
  globalThis.__lixuan = { getGame: () => game };
  $("#lobby").hidden = true;
  $("#game").hidden = false;
  showStatus("總部成立！先選一個鄰里，聽聽大家在意什麼。");
  renderGame();
  $("#neighborhoods button").focus();
});

$("#end-week").addEventListener("click", () => {
  const completedWeek = game.week;
  try {
    game = resolveWeek(game);
    globalThis.__lixuan = { getGame: () => game };
    renderGame();
    void showWeekResult(completedWeek);
  } catch (error) {
    showStatus(error.message, true);
  }
});

$("#week-continue").addEventListener("click", () => {
  audio.play("click");
  $("#week-sheet").hidden = true;
  if (game.phase === "ended") {
    game = null;
    $("#game").hidden = true;
    $("#lobby").hidden = false;
    $("#start-button").focus();
  } else {
    showStatus(`第 ${game.week} 週開始，還有 4 點行動力。`);
    renderGame();
    $("#neighborhoods button").focus();
  }
});

$("#about-button").addEventListener("click", () => {
  $("#about-sheet").hidden = false;
  $("#about-close").focus();
  audio.play("click");
});

$("#about-close").addEventListener("click", () => {
  $("#about-sheet").hidden = true;
  $("#about-button").focus();
  audio.play("click");
});

$("#sound-toggle").addEventListener("click", async () => {
  settings.sound = !settings.sound;
  audio.setEnabled(settings.sound);
  $("#sound-toggle").textContent = settings.sound ? "♪ 音效開" : "♩ 音效關";
  $("#sound-toggle").setAttribute("aria-pressed", String(settings.sound));
  await saveSettings(settings);
  if (settings.sound) audio.play("click");
});

[best, settings] = await Promise.all([loadBest(), loadSettings()]);
audio.setEnabled(settings.sound);
$("#best-value").textContent = best.toLocaleString("zh-TW");
$("#sound-toggle").textContent = settings.sound ? "♪ 音效開" : "♩ 音效關";
$("#sound-toggle").setAttribute("aria-pressed", String(settings.sound));
