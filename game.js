export const ISSUES = Object.freeze({
  traffic: "交通",
  security: "治安",
  environment: "環境",
  eldercare: "長照",
});

export const ACTIONS = Object.freeze({
  visit: { name: "拜訪", budget: 0, volunteers: 0 },
  event: { name: "辦活動", budget: 18, volunteers: 1 },
  proposal: { name: "提政見", budget: 8, volunteers: 0 },
  petition: { name: "處理陳情", budget: 4, volunteers: 1 },
  clarify: { name: "澄清", budget: 3, volunteers: 0 },
  gotv: { name: "催票", budget: 6, volunteers: 1 },
});

const NEIGHBORHOODS = [
  { id: "market", name: "市場口", population: 680, issues: ["traffic", "environment"] },
  { id: "station", name: "車站前", population: 760, issues: ["traffic", "security"] },
  { id: "oldtown", name: "老街坊", population: 590, issues: ["eldercare", "security"] },
  { id: "riverside", name: "河堤邊", population: 520, issues: ["environment", "traffic"] },
  { id: "school", name: "學園里", population: 640, issues: ["security", "environment"] },
  { id: "hillside", name: "山腳厝", population: 470, issues: ["eldercare", "traffic"] },
];

const CANDIDATES = [
  { id: "player", name: "你・新聲候選人", color: "#f36f56" },
  { id: "ai-care", name: "林美珠・服務派", color: "#26a69a" },
  { id: "ai-build", name: "王建國・建設派", color: "#6750a4" },
];

function hash(seed, value) {
  let n = (seed ^ Math.imul(value + 1, 0x9e3779b1)) >>> 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x21f0aaad);
  n ^= n >>> 15;
  n = Math.imul(n, 0x735a2d97);
  return (n ^ (n >>> 15)) >>> 0;
}

function random01(seed, value) {
  return hash(seed, value) / 0x100000000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function candidate(id) {
  const base = CANDIDATES.find((entry) => entry.id === id);
  return {
    ...base,
    trust: 6,
    budget: 72,
    volunteers: 5,
    promises: 0,
    actionsTaken: 0,
  };
}

export function createGame({ seed = Date.now() } = {}) {
  const safeSeed = Number(seed) >>> 0;
  const support = { player: 10, "ai-care": 10, "ai-build": 10 };
  const turnout = { player: 0, "ai-care": 0, "ai-build": 0 };
  return {
    seed: safeSeed,
    rng: hash(safeSeed, 88),
    week: 1,
    maxWeeks: 4,
    actionPoints: 4,
    phase: "campaign",
    candidates: CANDIDATES.map((entry) => candidate(entry.id)),
    neighborhoods: NEIGHBORHOODS.map((entry) => ({
      ...entry,
      support: { ...support },
      turnout: { ...turnout },
    })),
    pendingEvent: null,
    log: ["競選總部開張：先聽里民怎麼說。"],
    finalResult: null,
  };
}

export function proposalEffect(neighborhood, issue, trust, priorPromises) {
  const matched = neighborhood.issues.includes(issue);
  const credibility = clamp(trust / 6, 0.25, 1.25);
  const overpromisePenalty = Math.max(0, priorPromises - 1) * 0.75;
  return {
    matched,
    support: Math.max(0.25, (matched ? 2.6 : 0.8) * credibility - overpromisePenalty),
    trustDelta: priorPromises === 0 ? 0.2 : -0.6 * priorPromises,
  };
}

function validateAction(game, action, actor) {
  if (game.phase !== "campaign") throw new Error("選舉已經結束");
  if (!ACTIONS[action.type]) throw new Error("未知的競選行動");
  if (game.actionPoints <= 0 && actor === "player") throw new Error("本週行動點已用完");
  if (action.type === "gotv" && game.week !== 4) throw new Error("催票只在最後一週開放");
  if (action.type === "proposal" && !ISSUES[action.issue]) throw new Error("請選擇政見議題");
  const neighborhood = game.neighborhoods.find((entry) => entry.id === action.neighborhoodId);
  if (!neighborhood) throw new Error("找不到這個里鄰");
  const person = game.candidates.find((entry) => entry.id === actor);
  const cost = ACTIONS[action.type];
  if (person.budget < cost.budget || person.volunteers < cost.volunteers) {
    throw new Error("資源不足，無法執行這項行動");
  }
  return { neighborhood, person, cost };
}

function performAction(game, action, actor = "player") {
  const { neighborhood, person, cost } = validateAction(game, action, actor);
  person.budget -= cost.budget;
  person.volunteers -= cost.volunteers;
  person.actionsTaken += 1;
  if (actor === "player") game.actionPoints -= 1;

  let support = 0;
  let trust = 0;
  let turnout = 0;
  let note = "";

  if (action.type === "visit") {
    support = 1.2 + person.trust * 0.08;
    person.volunteers += random01(game.rng, person.actionsTaken) > 0.68 ? 1 : 0;
    note = `挨家挨戶拜訪 ${neighborhood.name}，記下里民的小事。`;
  } else if (action.type === "event") {
    support = 2.2 + person.volunteers * 0.12;
    turnout = 0.4;
    note = `${neighborhood.name} 的共餐活動很熱鬧，也留下整理場地的志工。`;
  } else if (action.type === "proposal") {
    const effect = proposalEffect(neighborhood, action.issue, person.trust, person.promises);
    support = effect.support;
    trust = effect.trustDelta;
    person.promises += 1;
    note = effect.matched
      ? `${ISSUES[action.issue]}政見切中 ${neighborhood.name} 的關心。`
      : `${ISSUES[action.issue]}政見有人鼓掌，但不是這區最急的事。`;
  } else if (action.type === "petition") {
    support = 1.7;
    trust = 0.65;
    note = `陳情有了具體回覆；${neighborhood.name} 覺得你做事有交代。`;
  } else if (action.type === "clarify") {
    const severity = game.pendingEvent?.severity ?? 0;
    support = severity ? 0.7 : 0.25;
    trust = severity ? 0.45 + severity * 0.2 : 0.1;
    game.pendingEvent = null;
    note = severity ? "公開資料、說清爭議，謠言沒有繼續發酵。" : "主動公布行程與帳目，透明也是日常功課。";
  } else if (action.type === "gotv") {
    const trustFactor = clamp(person.trust / 6, 0, 1.15);
    support = 0.7 * trustFactor;
    turnout = 1.2 * trustFactor;
    note = person.trust < 2
      ? "志工努力提醒投票，但信任不是最後一天才長得出來。"
      : `志工逐戶提醒 ${neighborhood.name} 投票時間與地點。`;
  }

  neighborhood.support[actor] = Math.max(0.1, neighborhood.support[actor] + support);
  neighborhood.turnout[actor] = Math.max(0, neighborhood.turnout[actor] + turnout);
  person.trust = clamp(person.trust + trust, 0, 10);
  game.log.unshift(note);
  game.log = game.log.slice(0, 8);
  return game;
}

export function applyAction(game, action) {
  const next = structuredClone(game);
  return performAction(next, action, "player");
}

function legalAiAction(game, person, index) {
  const neighborhood = game.neighborhoods[
    Math.floor(random01(game.rng + person.actionsTaken, index + game.week * 7) * game.neighborhoods.length)
  ];
  const preferredIssue = person.id === "ai-care" ? "eldercare" : index % 2 ? "traffic" : "security";
  const choices = game.week === 4
    ? ["gotv", "visit", "petition", "event"]
    : person.id === "ai-care"
      ? ["petition", "visit", "proposal", "event"]
      : ["proposal", "event", "visit", "petition"];
  let type = choices[index % choices.length];
  while (
    person.budget < ACTIONS[type].budget ||
    person.volunteers < ACTIONS[type].volunteers
  ) {
    type = "visit";
  }
  return { type, neighborhoodId: neighborhood.id, issue: preferredIssue };
}

export function aiTurn(game, candidateId) {
  const next = structuredClone(game);
  const person = next.candidates.find((entry) => entry.id === candidateId);
  if (!person || candidateId === "player") throw new Error("AI 候選人無效");
  const actions = [];
  for (let index = 0; index < 4; index += 1) {
    const action = legalAiAction(next, person, index);
    performAction(next, action, candidateId);
    actions.push(action);
  }
  return { game: next, candidate: next.candidates.find((entry) => entry.id === candidateId), actions };
}

function weeklyEvent(game) {
  const roll = random01(game.seed, game.week * 31);
  if (roll < 0.35) {
    const severity = 1 + Math.floor(random01(game.seed, game.week * 47) * 3);
    game.pendingEvent = { type: roll < 0.18 ? "rumor" : "controversy", severity };
    const player = game.candidates[0];
    player.trust = clamp(player.trust - severity * 0.35, 0, 10);
    game.log.unshift(
      roll < 0.18
        ? "社群出現沒有來源的傳言；可以用「澄清」公開資料回應。"
        : "活動支出被質疑；正面交代比互相攻擊更有用。",
    );
  } else {
    game.log.unshift("本週里務座談平穩，居民繼續比較大家的做法。");
  }
}

export function resolveWeek(game) {
  if (game.phase !== "campaign") throw new Error("選舉已經結束");
  let next = structuredClone(game);
  for (const id of ["ai-care", "ai-build"]) {
    next = aiTurn(next, id).game;
  }
  weeklyEvent(next);
  if (next.week >= next.maxWeeks) {
    next.phase = "ended";
    next.actionPoints = 0;
    next.finalResult = finalVotes(next);
  } else {
    next.week += 1;
    next.actionPoints = 4;
    for (const person of next.candidates) person.volunteers += 1;
  }
  next.rng = hash(next.rng, next.week);
  return next;
}

export function pollFor(game, neighborhoodId) {
  const neighborhood = game.neighborhoods.find((entry) => entry.id === neighborhoodId);
  if (!neighborhood) throw new Error("找不到這個里鄰");
  const total = game.candidates.reduce(
    (sum, person) => sum + neighborhood.support[person.id] * (0.65 + person.trust * 0.06),
    0,
  );
  return {
    neighborhoodId,
    margin: 4,
    candidates: game.candidates.map((person, index) => {
      const exact = (neighborhood.support[person.id] * (0.65 + person.trust * 0.06) / total) * 100;
      const error = (random01(game.seed, game.week * 101 + index * 13 + neighborhood.population) - 0.5) * 8;
      const center = clamp(Math.round(exact + error), 4, 92);
      return {
        id: person.id,
        name: person.name,
        low: clamp(center - 4, 0, 100),
        high: clamp(center + 4, 0, 100),
      };
    }),
  };
}

function allocateVotes(population, weights, ids) {
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const raw = weights.map((weight) => (population * weight) / totalWeight);
  const votes = raw.map(Math.floor);
  let remaining = population - votes.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value), id: ids[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.id.localeCompare(b.id));
  for (let index = 0; index < remaining; index += 1) votes[order[index].index] += 1;
  return votes;
}

export function finalVotes(game) {
  const totals = Object.fromEntries(game.candidates.map((person) => [person.id, 0]));
  const districts = game.neighborhoods.map((neighborhood) => {
    const ids = game.candidates.map((person) => person.id);
    const weights = game.candidates.map(
      (person) =>
        Math.max(0.1, neighborhood.support[person.id] + neighborhood.turnout[person.id]) *
        (0.7 + person.trust * 0.05),
    );
    const allocated = allocateVotes(neighborhood.population, weights, ids);
    const votes = Object.fromEntries(ids.map((id, index) => [id, allocated[index]]));
    ids.forEach((id) => {
      totals[id] += votes[id];
    });
    return { id: neighborhood.id, name: neighborhood.name, votes };
  });
  const ranking = game.candidates
    .map((person) => ({ id: person.id, name: person.name, color: person.color, votes: totals[person.id] }))
    .sort((a, b) => b.votes - a.votes || a.id.localeCompare(b.id));
  let lastVotes = null;
  let place = 0;
  ranking.forEach((entry, index) => {
    if (entry.votes !== lastVotes) place = index + 1;
    entry.place = place;
    lastVotes = entry.votes;
  });
  return {
    totalVotes: Object.values(totals).reduce((sum, value) => sum + value, 0),
    districts,
    ranking,
    winners: ranking.filter((entry) => entry.votes === ranking[0].votes),
  };
}
