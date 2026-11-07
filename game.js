"use strict";

/* =========================================================
   Tieň nad Hôrkou – textové RPG
   ========================================================= */

const SAVE_KEY = "tien-nad-horkou-save";

// ---------- Dáta ----------

const CLASSES = {
  bojovnik: {
    name: "Bojovník",
    desc: "Veľa zdravia a silné údery. Schopnosť: Drvivý úder (dvojnásobné poškodenie).",
    hp: 40, mp: 10, atk: 7, def: 4,
    skill: { name: "Drvivý úder", cost: 4 },
  },
  mag: {
    name: "Mág",
    desc: "Krehký, ale mocný. Schopnosť: Ohnivá guľa (ignoruje obranu, veľké poškodenie).",
    hp: 26, mp: 30, atk: 4, def: 2,
    skill: { name: "Ohnivá guľa", cost: 6 },
  },
  zlodej: {
    name: "Zlodej",
    desc: "Rýchly a šikovný, častejšie kritické zásahy. Schopnosť: Úder z tieňa (istý kritický zásah).",
    hp: 32, mp: 16, atk: 6, def: 3,
    skill: { name: "Úder z tieňa", cost: 5 },
  },
};

const ITEMS = {
  liek: { name: "Liečivý elixír", price: 12, desc: "Obnoví 20 zdravia." },
  mana: { name: "Modrý elixír", price: 15, desc: "Obnoví 15 many." },
  mec: { name: "Oceľový meč", price: 45, desc: "+3 útok", slot: "weapon", atk: 3 },
  palos: { name: "Runová palica", price: 70, desc: "+5 útok", slot: "weapon", atk: 5 },
  kozena: { name: "Kožená zbroj", price: 35, desc: "+2 obrana", slot: "armor", def: 2 },
  kruzkova: { name: "Krúžková zbroj", price: 80, desc: "+4 obrana", slot: "armor", def: 4 },
};

const ENEMIES = {
  vlk: { name: "Hladný vlk", hp: 16, atk: 6, def: 1, xp: 10, gold: [2, 6] },
  pavuk: { name: "Obrovský pavúk", hp: 20, atk: 7, def: 2, xp: 14, gold: [3, 8] },
  bandita: { name: "Lesný bandita", hp: 24, atk: 8, def: 2, xp: 18, gold: [8, 15] },
  goblin: { name: "Goblin", hp: 18, atk: 7, def: 2, xp: 12, gold: [4, 9] },
  netopier: { name: "Jaskynný netopier", hp: 12, atk: 6, def: 1, xp: 8, gold: [1, 4] },
  nacelnik: { name: "Goblinský náčelník Gruzz", hp: 55, atk: 11, def: 4, xp: 60, gold: [40, 50], boss: true },
  kostlivec: { name: "Kostlivý strážca", hp: 34, atk: 11, def: 5, xp: 30, gold: [10, 18] },
  prizrak: { name: "Bledý prízrak", hp: 30, atk: 13, def: 3, xp: 32, gold: [12, 20] },
  mag: { name: "Tieňový mág Morvent", hp: 110, atk: 15, def: 6, xp: 0, gold: [0, 0], boss: true, final: true },
};

// ---------- Stav ----------

let state = null;
let combat = null;

function newState(cls) {
  const c = CLASSES[cls];
  return {
    cls,
    name: "",
    level: 1,
    xp: 0,
    hp: c.hp, maxHp: c.hp,
    mp: c.mp, maxMp: c.mp,
    atk: c.atk, def: c.def,
    gold: 20,
    inv: { liek: 2, mana: 0 },
    weapon: null,
    armor: null,
    scene: "dedina",
    flags: {},
  };
}

// ---------- Pomocné funkcie ----------

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const xpNeeded = (lvl) => 20 + (lvl - 1) * 25;

function totalAtk() {
  return state.atk + (state.weapon ? ITEMS[state.weapon].atk : 0);
}
function totalDef() {
  return state.def + (state.armor ? ITEMS[state.armor].def : 0);
}

function log(msg, cls = "") {
  const d = document.createElement("div");
  d.textContent = msg;
  if (cls) d.className = cls;
  $("log").prepend(d);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// ---------- Vykresľovanie ----------

function renderStats() {
  const el = $("stats");
  if (!state) { el.innerHTML = ""; return; }
  const s = state;
  const pct = (a, b) => Math.max(0, Math.min(100, (a / b) * 100));
  el.innerHTML = `
    <div class="stat-row">
      <div><strong>${escapeHtml(s.name)}</strong> <span class="muted">${CLASSES[s.cls].name}, úroveň ${s.level}</span></div>
      <div>Zlato: <span style="color:var(--accent)">${s.gold}</span></div>
      <div>Útok ${totalAtk()} · Obrana ${totalDef()}</div>
    </div>
    <div class="stat-row" style="margin-top:6px">
      <div>Zdravie ${s.hp}/${s.maxHp}<div class="bar hp"><span style="width:${pct(s.hp, s.maxHp)}%"></span></div></div>
      <div>Mana ${s.mp}/${s.maxMp}<div class="bar mp"><span style="width:${pct(s.mp, s.maxMp)}%"></span></div></div>
      <div>Skúsenosti ${s.xp}/${xpNeeded(s.level)}<div class="bar xp"><span style="width:${pct(s.xp, xpNeeded(s.level))}%"></span></div></div>
    </div>
    <div class="muted" style="margin-top:6px">
      Výbava: ${s.weapon ? ITEMS[s.weapon].name : "bez zbrane"}, ${s.armor ? ITEMS[s.armor].name : "bez zbroje"} ·
      Elixíry: ${s.inv.liek || 0}× liečivý, ${s.inv.mana || 0}× modrý
    </div>`;
}

function show(paragraphs, choices) {
  $("story").innerHTML = paragraphs.map((p) => `<p>${p}</p>`).join("");
  const box = $("choices");
  box.innerHTML = "";
  for (const ch of choices) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = ch.label;
    if (ch.disabled) b.disabled = true;
    b.addEventListener("click", ch.action);
    box.appendChild(b);
  }
  renderStats();
}

function go(scene) {
  state.scene = scene;
  SCENES[scene]();
}

// ---------- Úvod ----------

function startScreen() {
  state = null;
  combat = null;
  $("log").innerHTML = "";
  const hasSave = !!safeGet();
  show(
    [
      "Dedinku Hôrka už tri mesiace zahaľuje zvláštny tieň. Úroda hnije, studne sú kalné a v noci z lesa počuť šepot.",
      "Starosta rozposlal posla do širokého okolia: kto zbaví Hôrku kliatby, toho odmení. Ty si jediný, kto prišiel.",
    ],
    [
      { label: "Začať nové dobrodružstvo", action: chooseName },
      { label: "Pokračovať v uloženej hre", action: loadGame, disabled: !hasSave },
    ]
  );
}

function chooseName() {
  $("story").innerHTML = `<p>Ako sa voláš, pocestný?</p>
    <p><input id="name-input" maxlength="20" placeholder="Tvoje meno"
      style="font:inherit;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--text);width:100%;max-width:300px"></p>`;
  const box = $("choices");
  box.innerHTML = "";
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = "Pokračovať";
  const submit = () => {
    const name = ($("name-input").value || "").trim() || "Pocestný";
    chooseClass(name);
  };
  b.addEventListener("click", submit);
  box.appendChild(b);
  const input = $("name-input");
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  input.focus();
}

function chooseClass(name) {
  show(
    [`Vitaj, <strong>${escapeHtml(name)}</strong>. Akou cestou kráčaš?`,
      ...Object.values(CLASSES).map((c) => `<strong>${c.name}</strong> – <span class="muted">${c.desc}</span>`)],
    Object.entries(CLASSES).map(([key, c]) => ({
      label: c.name,
      action: () => {
        state = newState(key);
        state.name = name;
        log(`${name} sa vydáva na cestu ako ${c.name.toLowerCase()}.`, "good");
        go("dedina");
      },
    }))
  );
}

// ---------- Scény ----------

const SCENES = {
  dedina() {
    const f = state.flags;
    const text = ["Stojíš na námestí v Hôrke. Pár zhrbených dedinčanov ťa pozoruje s nádejou aj strachom."];
    if (f.won) text.push("Nad dedinou opäť svieti slnko. Deti sa hrajú pri studni a ľudia sa na teba usmievajú.");
    show(text, [
      { label: "Navštíviť starostu", action: () => go("starosta") },
      { label: "Ísť do obchodu", action: () => go("obchod") },
      { label: "Prenocovať v hostinci (8 zlatých)", action: rest },
      { label: "Vydať sa do Šepkavého lesa", action: () => go("les") },
      { label: "Ísť k Zubatej jaskyni", action: () => go("jaskyna"), disabled: !f.caveKnown },
      { label: "Ísť k Zrúcanej veži", action: () => go("veza"), disabled: !f.towerKnown },
    ]);
  },

  starosta() {
    const f = state.flags;
    let text;
    if (f.won) {
      text = ["Starosta Ondrej ťa objíme. „Si hrdina Hôrky! Tvoje meno budú spievať ešte naši vnuci.“"];
    } else if (f.chiefDead && !f.towerKnown) {
      f.towerKnown = true;
      text = [
        "Ukážeš starostovi amulet, ktorý mal náčelník Gruzz na krku. Starosta zbledne.",
        "„To je znak Morventa – mága, ktorého sme pred rokmi vyhnali. Usadil sa v Zrúcanej veži za lesom. Goblini boli len jeho sluhovia. Ak chceš kliatbu zlomiť, musíš ísť za ním.“",
        "Starosta ti do dlane vloží 30 zlatých. „Na lepšiu výzbroj. Budeš ju potrebovať.“",
      ];
      state.gold += 30;
      log("Dostal si 30 zlatých. Objavená lokalita: Zrúcaná veža.", "gold");
    } else if (f.towerKnown) {
      text = ["„Morvent čaká vo veži,“ hovorí starosta. „Choď, až budeš pripravený. A vezmi si elixíry.“"];
    } else if (f.caveKnown) {
      text = ["„Goblini zo Zubatej jaskyne kradnú naše ovce,“ vzdychá starosta. „Ich náčelník Gruzz má niečo spoločné s tým tieňom, som si istý.“"];
    } else {
      text = [
        "Starosta Ondrej je starý muž s unavenými očami. „Vďaka, že si prišiel,“ povie.",
        "„Všetko začalo, keď sa v lese objavili goblini. Drevorubači hovoria, že ich stopy vedú k nejakej jaskyni. Preskúmaj Šepkavý les a nájdi ju.“",
      ];
      f.quest = true;
    }
    show(text, [{ label: "Späť na námestie", action: () => go("dedina") }]);
  },

  obchod() {
    const text = [
      "Obchodníčka Zuzka si utiera ruky do zástery. „Čo to bude?“",
      `<span class="muted">Máš ${state.gold} zlatých.</span>`,
    ];
    const choices = Object.entries(ITEMS).map(([key, it]) => {
      const owned = state.weapon === key || state.armor === key;
      return {
        label: `${it.name} – ${it.price} zl. (${it.desc})${owned ? " ✓ máš" : ""}`,
        disabled: owned || state.gold < it.price,
        action: () => buy(key),
      };
    });
    choices.push({ label: "Odísť", action: () => go("dedina") });
    show(text, choices);
  },

  les() {
    show(["Šepkavý les je hustý a tmavý. Medzi stromami sa vlní hmla a niekde v diaľke praskne konár."], [
      { label: "Prehľadať les", action: exploreForest },
      { label: "Vrátiť sa do dediny", action: () => go("dedina") },
    ]);
  },

  jaskyna() {
    const f = state.flags;
    const text = f.chiefDead
      ? ["Jaskyňa je teraz tichá. Po goblinoch zostali len rozhádzané kosti a zhasnuté ohniská."]
      : ["Vstup do Zubatej jaskyne pripomína otvorenú tlamu. Zvnútra páchne dym a počuť chrapľavý smiech goblinov."];
    const choices = [];
    if (!f.chiefDead) {
      choices.push({ label: "Zakradnúť sa hlbšie", action: exploreCave });
      choices.push({
        label: f.caveDepth >= 2 ? "Vstúpiť do sály náčelníka" : "Sála náčelníka (najprv preskúmaj jaskyňu)",
        disabled: !(f.caveDepth >= 2),
        action: () => startCombat("nacelnik", () => {
          f.chiefDead = true;
          log("Našiel si zvláštny čierny amulet. Možno o ňom niečo vie starosta.", "good");
          go("jaskyna");
        }),
      });
    } else {
      choices.push({ label: "Preskúmať jaskyňu (slabší nepriatelia)", action: exploreCave });
    }
    choices.push({ label: "Vrátiť sa do dediny", action: () => go("dedina") });
    show(text, choices);
  },

  veza() {
    const f = state.flags;
    if (f.won) {
      show(["Z veže zostali len studené kamene. Tieň zmizol navždy."],
        [{ label: "Vrátiť sa do dediny", action: () => go("dedina") }]);
      return;
    }
    const floor = f.towerFloor || 0;
    const text = [
      "Zrúcaná veža sa týči nad korunami stromov. Okolo nej víri čierny dym a vzduch je ťažký ako pred búrkou.",
      `<span class="muted">Postup vežou: ${floor}/2 poschodí.</span>`,
    ];
    const choices = [];
    if (floor < 2) {
      choices.push({
        label: `Vystúpiť na ${floor + 1}. poschodie`,
        action: () => {
          const foe = floor === 0 ? "kostlivec" : "prizrak";
          startCombat(foe, () => { f.towerFloor = floor + 1; go("veza"); });
        },
      });
    } else {
      choices.push({
        label: "Vstúpiť do Morventovej komnaty",
        action: () => go("morvent"),
      });
    }
    choices.push({ label: "Vrátiť sa do dediny", action: () => go("dedina") });
    show(text, choices);
  },

  morvent() {
    if (state.flags.won) return go("veza");
    show(
      [
        "Na vrchole veže stojí vysoká postava v plášti z tieňov. Oči jej žiaria fialovým svetlom.",
        "„Ďalší hrdina,“ zasyčí Morvent. „Hôrka ma vyhnala. Teraz bude patriť mne – navždy.“",
      ],
      [
        { label: "Bojovať!", action: () => startCombat("mag", victory) },
        {
          label: "Ponúknuť mu zlato, aby odišiel",
          action: () => {
            show(["Morvent sa krákavo zasmeje. „Zlato? Chcem pomstu, nie mince!“ Mávne rukou a tieň ťa zasiahne."],
              [{ label: "Bojovať!", action: () => { state.hp = Math.max(1, state.hp - 8); log("Morventovo kúzlo ti zobralo 8 zdravia.", "bad"); startCombat("mag", victory); } }]);
          },
        },
      ]
    );
  },
};

// ---------- Akcie ----------

function rest() {
  if (state.gold < 8) {
    log("Nemáš dosť zlata na nocľah.", "bad");
    return;
  }
  state.gold -= 8;
  state.hp = state.maxHp;
  state.mp = state.maxMp;
  log("Vyspal si sa v hostinci U Zlatého klasu. Zdravie a mana sú obnovené.", "good");
  go("dedina");
}

function buy(key) {
  const it = ITEMS[key];
  if (state.gold < it.price) return;
  state.gold -= it.price;
  if (it.slot === "weapon") state.weapon = key;
  else if (it.slot === "armor") state.armor = key;
  else state.inv[key] = (state.inv[key] || 0) + 1;
  log(`Kúpil si: ${it.name}.`, "gold");
  go("obchod");
}

function exploreForest() {
  const f = state.flags;
  f.forestSearches = (f.forestSearches || 0) + 1;

  if (!f.caveKnown && f.forestSearches >= 3) {
    f.caveKnown = true;
    show(
      [
        "Nasleduješ čerstvé stopy cez blato až k skalnatému svahu. Medzi balvanmi zíva temný otvor – Zubatá jaskyňa!",
        "Pri vchode visia kosti a kus roztrhaného plátna s namaľovaným okom.",
      ],
      [{ label: "Pokračovať", action: () => go("les") }]
    );
    log("Objavená lokalita: Zubatá jaskyňa.", "good");
    return;
  }

  const roll = Math.random();
  if (roll < 0.6) {
    const foes = state.level >= 3 ? ["vlk", "pavuk", "bandita"] : ["vlk", "pavuk"];
    startCombat(foes[rand(0, foes.length - 1)], () => go("les"));
  } else if (roll < 0.8) {
    const g = rand(3, 10);
    state.gold += g;
    log(`Pod koreňom starého duba si našiel mešec s ${g} zlatými.`, "gold");
    show(["Narazil si na opustený tábor. V popole sa niečo zaleskne – mešec so zlatom!"],
      [{ label: "Pokračovať", action: () => go("les") }]);
  } else {
    const heal = rand(6, 12);
    state.hp = Math.min(state.maxHp, state.hp + heal);
    log(`Natrhal si liečivé byliny a obnovil ${heal} zdravia.`, "good");
    show(["Na čistinke rastú liečivé byliny. Rozžuješ pár lístkov a cítiš sa lepšie."],
      [{ label: "Pokračovať", action: () => go("les") }]);
  }
}

function exploreCave() {
  const f = state.flags;
  f.caveDepth = (f.caveDepth || 0) + 1;
  if (Math.random() < 0.15) {
    state.inv.liek = (state.inv.liek || 0) + 1;
    log("V goblinskej skrýši si našiel Liečivý elixír.", "good");
    show(["Za balvanom nájdeš goblinskú skrýšu. Väčšinou haraburdie, ale jeden elixír je celý!"],
      [{ label: "Pokračovať", action: () => go("jaskyna") }]);
    return;
  }
  const foe = Math.random() < 0.5 ? "goblin" : "netopier";
  startCombat(foe, () => {
    if (f.caveDepth === 2 && !f.chiefDead) log("Z hlbín jaskyne počuť dunenie bubnov. Sála náčelníka je blízko.");
    go("jaskyna");
  });
}

// ---------- Súboj ----------

function startCombat(enemyKey, onWin) {
  const e = ENEMIES[enemyKey];
  combat = { key: enemyKey, enemy: { ...e, maxHp: e.hp }, onWin, defending: false };
  log(`Na scénu vstupuje ${e.name}!`, "bad");
  renderCombat([e.boss ? `Pred tebou stojí <span class="enemy">${e.name}</span>. Toto bude ťažký boj!`
    : `Zaútočil na teba <span class="enemy">${e.name}</span>!`]);
}

function renderCombat(extra = []) {
  const e = combat.enemy;
  const sk = CLASSES[state.cls].skill;
  show(
    [...extra, `<span class="enemy">${e.name}</span>: ${Math.max(0, e.hp)}/${e.maxHp} zdravia`],
    [
      { label: "Zaútočiť", action: () => playerTurn("attack") },
      { label: `${sk.name} (${sk.cost} many)`, action: () => playerTurn("skill"), disabled: state.mp < sk.cost },
      { label: "Brániť sa", action: () => playerTurn("defend") },
      { label: `Vypiť liečivý elixír (${state.inv.liek || 0})`, action: () => playerTurn("potion"), disabled: !state.inv.liek },
      { label: `Vypiť modrý elixír (${state.inv.mana || 0})`, action: () => playerTurn("mana"), disabled: !state.inv.mana },
      { label: "Utiecť", action: () => playerTurn("flee"), disabled: !!e.boss },
    ]
  );
}

function damage(atk, def, crit = false) {
  let dmg = Math.max(1, atk + rand(-2, 2) - def);
  if (crit) dmg = Math.floor(dmg * 1.8);
  return dmg;
}

function playerTurn(action) {
  const e = combat.enemy;
  const sk = CLASSES[state.cls].skill;
  const lines = [];
  combat.defending = false;

  if (action === "attack") {
    const critChance = state.cls === "zlodej" ? 0.25 : 0.1;
    const crit = Math.random() < critChance;
    const d = damage(totalAtk(), e.def, crit);
    e.hp -= d;
    lines.push(crit ? `Kritický zásah! Udelil si ${d} poškodenia.` : `Zasiahol si nepriateľa za ${d}.`);
  } else if (action === "skill") {
    state.mp -= sk.cost;
    let d;
    if (state.cls === "bojovnik") d = damage(totalAtk(), e.def) * 2;
    else if (state.cls === "mag") d = totalAtk() + 8 + state.level * 2 + rand(0, 4);
    else d = damage(totalAtk(), e.def, true) + 2;
    e.hp -= d;
    lines.push(`${sk.name}! Udelil si ${d} poškodenia.`);
  } else if (action === "defend") {
    combat.defending = true;
    const r = 2 + Math.floor(state.maxMp / 10);
    state.mp = Math.min(state.maxMp, state.mp + r);
    lines.push(`Zaujal si obranný postoj a sústredil sa (+${r} many).`);
  } else if (action === "potion") {
    state.inv.liek--;
    const before = state.hp;
    state.hp = Math.min(state.maxHp, state.hp + 20);
    lines.push(`Vypil si liečivý elixír (+${state.hp - before} zdravia).`);
  } else if (action === "mana") {
    state.inv.mana--;
    const before = state.mp;
    state.mp = Math.min(state.maxMp, state.mp + 15);
    lines.push(`Vypil si modrý elixír (+${state.mp - before} many).`);
  } else if (action === "flee") {
    if (Math.random() < 0.6) {
      log("Podarilo sa ti utiecť.");
      combat = null;
      SCENES[state.scene]();
      return;
    }
    lines.push("Pokúsil si sa utiecť, ale nepriateľ ti zahradil cestu!");
  }

  lines.forEach((l) => log(l));

  if (e.hp <= 0) return winCombat();

  // Ťah nepriateľa
  let eAtk = e.atk;
  let special = "";
  if (combat.key === "mag" && Math.random() < 0.3) {
    eAtk += 6;
    special = "Morvent vrhá tieňový blesk! ";
  } else if (combat.key === "nacelnik" && Math.random() < 0.25) {
    eAtk += 4;
    special = "Gruzz sa rozbehne s obrovským kyjom! ";
  }
  let d = damage(eAtk, totalDef());
  if (combat.defending) d = Math.max(0, Math.floor(d / 2));
  state.hp -= d;
  const enemyLine = `${special}${e.name} ťa zasiahol za ${d}.`;
  log(enemyLine, "bad");

  if (state.hp <= 0) return defeat();

  renderCombat([...lines, enemyLine]);
}

function winCombat() {
  const e = combat.enemy;
  const gold = rand(e.gold[0], e.gold[1]);
  state.gold += gold;
  state.xp += e.xp;
  const onWin = combat.onWin;
  combat = null;
  log(`Porazil si: ${e.name}. +${e.xp} skúseností, +${gold} zlatých.`, "gold");
  if (Math.random() < 0.2 && !e.final) {
    state.inv.liek = (state.inv.liek || 0) + 1;
    log("Nepriateľ mal pri sebe Liečivý elixír!", "good");
  }
  checkLevelUp();
  if (e.final) return onWin();
  show([`<span class="enemy">${e.name}</span> padol k zemi. Zvíťazil si!`],
    [{ label: "Pokračovať", action: onWin }]);
}

function checkLevelUp() {
  while (state.xp >= xpNeeded(state.level)) {
    state.xp -= xpNeeded(state.level);
    state.level++;
    const g = { bojovnik: [8, 2, 2, 1], mag: [5, 6, 1, 1], zlodej: [6, 3, 2, 1] }[state.cls];
    state.maxHp += g[0];
    state.maxMp += g[1];
    state.atk += g[2];
    state.def += g[3];
    state.hp = state.maxHp;
    state.mp = state.maxMp;
    log(`Postúpil si na úroveň ${state.level}! Si silnejší a plne zregenerovaný.`, "good");
  }
}

function defeat() {
  combat = null;
  state.hp = 0;
  const hasSave = !!safeGet();
  show(
    [
      "Svet sa ti zatmie pred očami. Padáš na zem a tieň sa nad tebou zatvára…",
      "<strong>Prehral si.</strong>",
    ],
    [
      { label: "Prebudiť sa v dedine (stratíš polovicu zlata)", action: () => {
        state.gold = Math.floor(state.gold / 2);
        state.hp = Math.ceil(state.maxHp / 2);
        state.mp = Math.ceil(state.maxMp / 2);
        log("Dedinčania ťa našli a priniesli späť do Hôrky.", "bad");
        go("dedina");
      } },
      { label: "Načítať uloženú hru", action: loadGame, disabled: !hasSave },
      { label: "Nová hra", action: startScreen },
    ]
  );
}

function victory() {
  state.flags.won = true;
  state.scene = "dedina";
  log("Morvent je porazený! Kliatba nad Hôrkou je zlomená.", "good");
  show(
    [
      "Morvent vykríkne a jeho telo sa rozpadne na čierny prach. Tieň nad krajinou sa trhá ako starý závoj a dnu prenikne slnko.",
      "Keď sa vrátiš do Hôrky, celá dedina ťa víta s kvetmi a spevom. Studne sú opäť čisté a polia zelené.",
      `<strong>Gratulujem, ${escapeHtml(state.name)}! Dohral si hru na úrovni ${state.level}.</strong>`,
    ],
    [
      { label: "Vrátiť sa do dediny", action: () => go("dedina") },
      { label: "Nová hra", action: startScreen },
    ]
  );
}

// ---------- Ukladanie ----------

function safeGet() {
  try { return localStorage.getItem(SAVE_KEY); } catch { return null; }
}

function saveGame() {
  if (!state) return log("Nie je čo uložiť.", "bad");
  if (combat) return log("Počas súboja sa nedá ukladať.", "bad");
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    log("Hra bola uložená.", "good");
  } catch {
    log("Uloženie zlyhalo.", "bad");
  }
}

function loadGame() {
  const raw = safeGet();
  if (!raw) return log("Žiadna uložená hra.", "bad");
  try {
    state = JSON.parse(raw);
    combat = null;
    log("Hra bola načítaná.", "good");
    if (state.hp <= 0) state.hp = 1;
    go(SCENES[state.scene] ? state.scene : "dedina");
  } catch {
    log("Uložená hra je poškodená.", "bad");
  }
}

$("btn-save").addEventListener("click", saveGame);
$("btn-load").addEventListener("click", loadGame);
let confirmTimer = null;
$("btn-new").addEventListener("click", () => {
  const btn = $("btn-new");
  if (!state || confirmTimer) {
    clearTimeout(confirmTimer);
    confirmTimer = null;
    btn.textContent = "Nová hra";
    startScreen();
    return;
  }
  btn.textContent = "Naozaj? Klikni znova";
  log("Neuložený postup sa stratí. Pre novú hru klikni ešte raz.", "bad");
  confirmTimer = setTimeout(() => { confirmTimer = null; btn.textContent = "Nová hra"; }, 3000);
});

startScreen();
