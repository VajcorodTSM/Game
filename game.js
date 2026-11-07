"use strict";

/* =========================================================
   Tieň nad Hôrkou – textové RPG
   ========================================================= */

const SAVE_KEY = "tien-nad-horkou-save";

// ---------- Dáta ----------

const CLASSES = {
  bojovnik: {
    name: "Bojovník", nameF: "Bojovníčka",
    desc: "Veľa zdravia a silné údery. Schopnosť: Drvivý úder (dvojnásobné poškodenie).",
    hp: 40, mp: 10, atk: 7, def: 4,
    skill: { name: "Drvivý úder", cost: 4 },
  },
  mag: {
    name: "Mág", nameF: "Mágička",
    desc: "Málo zdravia, ale ničivé kúzla. Schopnosť: Ohnivá guľa (ignoruje obranu, veľké poškodenie).",
    hp: 26, mp: 30, atk: 4, def: 2,
    skill: { name: "Ohnivá guľa", cost: 6 },
  },
  zlodej: {
    name: "Zlodej", nameF: "Zlodejka",
    desc: "Rýchlosť a šikovnosť, častejšie kritické zásahy. Schopnosť: Úder z tieňa (istý kritický zásah).",
    hp: 32, mp: 16, atk: 6, def: 3,
    skill: { name: "Úder z tieňa", cost: 5 },
  },
};

const ATTRS = {
  sila: { name: "Sila", desc: "+1 útok za každý bod" },
  obratnost: { name: "Obratnosť", desc: "+3 % šanca na kritický zásah, ľahší útek" },
  inteligencia: { name: "Inteligencia", desc: "+4 mana a silnejšia schopnosť za každý bod" },
  odolnost: { name: "Odolnosť", desc: "+4 zdravie za každý bod, +1 obrana za každé 2 body" },
};
const ATTR_BASE = 1;
const ATTR_MAX = 5;
const ATTR_POINTS = 6;

const ORIGINS = {
  kovac: {
    name: "Kováčska rodina",
    desc: "Vyrastal si pri vyhni. +1 Sila a začínaš v koženej zbroji.",
    descF: "Vyrastala si pri vyhni. +1 Sila a začínaš v koženej zbroji.",
    attr: "sila",
    apply: (s) => { s.armor = "kozena"; },
  },
  lovec: {
    name: "Lovecký rod z hôr",
    desc: "Poznáš stopy aj byliny. +1 Obratnosť a 2 liečivé elixíry navyše.",
    attr: "obratnost",
    apply: (s) => { s.inv.liek += 2; },
  },
  klastor: {
    name: "Kláštorný učeň",
    desc: "Roky si študoval staré knihy. +1 Inteligencia a 2 modré elixíry.",
    descF: "Roky si študovala staré knihy. +1 Inteligencia a 2 modré elixíry.",
    attr: "inteligencia",
    apply: (s) => { s.inv.mana += 2; },
  },
  kupec: {
    name: "Kupecká rodina",
    desc: "Peniaze otvárajú dvere. Začínaš so 60 zlatými namiesto 20.",
    apply: (s) => { s.gold += 40; },
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
const g = (m, f) => (state && state.gender === "f" ? f : m);
const attr = (k) => (state && state.attrs ? state.attrs[k] : ATTR_BASE);
const className = (s) => (s.gender === "f" ? CLASSES[s.cls].nameF : CLASSES[s.cls].name);

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
      <div><strong>${escapeHtml(s.name)}</strong> <span class="muted">${className(s)}${s.origin ? ` (${ORIGINS[s.origin].name})` : ""}, úroveň ${s.level}</span></div>
      <div>Zlato: <span style="color:var(--accent)">${s.gold}</span></div>
      <div>Útok ${totalAtk()} · Obrana ${totalDef()}</div>
    </div>
    <div class="stat-row" style="margin-top:6px">
      <div>Zdravie ${s.hp}/${s.maxHp}<div class="bar hp"><span style="width:${pct(s.hp, s.maxHp)}%"></span></div></div>
      <div>Mana ${s.mp}/${s.maxMp}<div class="bar mp"><span style="width:${pct(s.mp, s.maxMp)}%"></span></div></div>
      <div>Skúsenosti ${s.xp}/${xpNeeded(s.level)}<div class="bar xp"><span style="width:${pct(s.xp, xpNeeded(s.level))}%"></span></div></div>
    </div>
    <div class="muted" style="margin-top:6px">
      ${Object.entries(ATTRS).map(([k, a]) => `${a.name} ${attr(k)}`).join(" · ")}
    </div>
    <div class="muted">
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
  draft = null;
  combat = null;
  $("log").innerHTML = "";
  const hasSave = !!safeGet();
  show(
    [
      "Dedinku Hôrka už tri mesiace zahaľuje zvláštny tieň. Úroda hnije, studne sú kalné a v noci z lesa počuť šepot.",
      "Starosta rozposlal posla do širokého okolia: kto zbaví Hôrku kliatby, toho odmení. Ozval sa jediný človek – ty.",
    ],
    [
      { label: "Začať nové dobrodružstvo", action: chooseName },
      { label: "Pokračovať v uloženej hre", action: loadGame, disabled: !hasSave },
    ]
  );
}

// ---------- Tvorba postavy ----------

let draft = null;

function newDraft() {
  return {
    name: "",
    gender: "m",
    cls: "bojovnik",
    origin: "kovac",
    attrs: Object.fromEntries(Object.keys(ATTRS).map((k) => [k, ATTR_BASE])),
  };
}

function pointsLeft(d) {
  const used = Object.values(d.attrs).reduce((a, v) => a + (v - ATTR_BASE), 0);
  return ATTR_POINTS - used;
}

function buildCharacter(d) {
  const s = newState(d.cls);
  s.name = d.name.trim() || (d.gender === "f" ? "Pocestná" : "Pocestný");
  s.gender = d.gender;
  s.origin = d.origin;
  const o = ORIGINS[d.origin];
  const a = { ...d.attrs };
  if (o.attr) a[o.attr] += 1;
  s.attrs = a;
  s.atk += a.sila - ATTR_BASE;
  s.maxHp += (a.odolnost - ATTR_BASE) * 4;
  s.def += Math.floor((a.odolnost - ATTR_BASE) / 2);
  s.maxMp += (a.inteligencia - ATTR_BASE) * 4;
  s.hp = s.maxHp;
  s.mp = s.maxMp;
  o.apply(s);
  return s;
}

function optionGroup(field, options) {
  return `<div class="opts" role="group">${options.map(([val, label]) =>
    `<button type="button" class="opt" data-field="${field}" data-val="${val}" aria-pressed="${draft[field] === val}">${label}</button>`
  ).join("")}</div>`;
}

function chooseName() {
  draft = newDraft();
  renderCreation();
  const input = $("name-input");
  if (input) input.focus();
}

function renderCreation() {
  const d = draft;
  const f = d.gender === "f";
  const left = pointsLeft(d);
  const preview = buildCharacter(d);
  const c = CLASSES[d.cls];
  const o = ORIGINS[d.origin];
  const originDesc = f && o.descF ? o.descF : o.desc;

  $("story").innerHTML = `
    <div class="creation">
      <section>
        <h2>Meno</h2>
        <input id="name-input" class="text-input" maxlength="20" placeholder="${f ? "Pocestná" : "Pocestný"}" value="${escapeHtml(d.name)}" autocomplete="off">
      </section>

      <section>
        <h2>Pohlavie</h2>
        ${optionGroup("gender", [["m", "Muž"], ["f", "Žena"]])}
      </section>

      <section>
        <h2>Povolanie</h2>
        ${optionGroup("cls", Object.entries(CLASSES).map(([k, x]) => [k, f ? x.nameF : x.name]))}
        <p class="hint">${c.desc}</p>
      </section>

      <section>
        <h2>Pôvod</h2>
        ${optionGroup("origin", Object.entries(ORIGINS).map(([k, x]) => [k, x.name]))}
        <p class="hint">${originDesc}</p>
      </section>

      <section>
        <h2>Vlastnosti <span class="points ${left === 0 ? "done" : ""}">Zostáva bodov: ${left}</span></h2>
        <div class="attrs">
          ${Object.entries(ATTRS).map(([k, a]) => {
            const bonus = o.attr === k ? 1 : 0;
            return `<div class="attr-row">
              <div class="attr-info"><strong>${a.name}</strong><span class="hint">${a.desc}</span></div>
              <div class="attr-ctrl">
                <button type="button" class="step" data-attr="${k}" data-delta="-1" aria-label="Znížiť ${a.name}" ${d.attrs[k] <= ATTR_BASE ? "disabled" : ""}>−</button>
                <span class="attr-val">${d.attrs[k] + bonus}${bonus ? '<small>+1</small>' : ""}</span>
                <button type="button" class="step" data-attr="${k}" data-delta="1" aria-label="Zvýšiť ${a.name}" ${left <= 0 || d.attrs[k] >= ATTR_MAX ? "disabled" : ""}>+</button>
              </div>
            </div>`;
          }).join("")}
        </div>
      </section>

      <section class="preview">
        <h2>Tvoja postava</h2>
        <p><strong>${escapeHtml(preview.name)}</strong>, ${className(preview).toLowerCase()} – ${o.name.toLowerCase()}</p>
        <div class="preview-stats">
          <span>Zdravie <b>${preview.maxHp}</b></span>
          <span>Mana <b>${preview.maxMp}</b></span>
          <span>Útok <b>${preview.atk + (preview.weapon ? ITEMS[preview.weapon].atk : 0)}</b></span>
          <span>Obrana <b>${preview.def + (preview.armor ? ITEMS[preview.armor].def : 0)}</b></span>
          <span>Zlato <b>${preview.gold}</b></span>
        </div>
      </section>
    </div>`;

  const box = $("choices");
  box.innerHTML = "";
  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "primary";
  startBtn.textContent = left > 0 ? `Rozdeľ ešte ${left} ${left === 1 ? "bod" : left < 5 ? "body" : "bodov"}` : "Začať dobrodružstvo";
  startBtn.disabled = left > 0;
  startBtn.addEventListener("click", finishCreation);
  box.appendChild(startBtn);
  const back = document.createElement("button");
  back.type = "button";
  back.textContent = "Späť";
  back.addEventListener("click", startScreen);
  box.appendChild(back);

  const input = $("name-input");
  input.addEventListener("input", () => {
    draft.name = input.value;
    const p = document.querySelector(".preview p strong");
    if (p) p.textContent = draft.name.trim() || (draft.gender === "f" ? "Pocestná" : "Pocestný");
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });

  $("story").querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
    draft[b.dataset.field] = b.dataset.val;
    rerenderCreation(b);
  }));
  $("story").querySelectorAll(".step").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.attr;
    const delta = Number(b.dataset.delta);
    const next = draft.attrs[k] + delta;
    if (next < ATTR_BASE || next > ATTR_MAX) return;
    if (delta > 0 && pointsLeft(draft) <= 0) return;
    draft.attrs[k] = next;
    rerenderCreation(b);
  }));
}

// Prekreslí formulár a vráti fokus na rovnaké tlačidlo (dôležité pre klávesnicu).
function rerenderCreation(btn) {
  const sel = btn.dataset.attr
    ? `.step[data-attr="${btn.dataset.attr}"][data-delta="${btn.dataset.delta}"]`
    : `.opt[data-field="${btn.dataset.field}"][data-val="${btn.dataset.val}"]`;
  const hadFocus = document.activeElement === btn;
  renderCreation();
  if (hadFocus) {
    const again = document.querySelector(sel);
    if (again && !again.disabled) again.focus();
  }
}

function finishCreation() {
  if (pointsLeft(draft) > 0) return;
  state = buildCharacter(draft);
  draft = null;
  log(`${state.name} sa vydáva na cestu – ${className(state).toLowerCase()}, ${ORIGINS[state.origin].name.toLowerCase()}.`, "good");
  show(
    [
      `Tvoja cesta do Hôrky trvala tri dni. Keď konečne ${g("vyšiel", "vyšla")} z lesa, uvidel${g("", "a")} si dedinku zahalenú sivým oparom, hoci všade okolo svietilo slnko.`,
      `Pri bráne ťa čaká starosta Ondrej. „Takže ty si ${g("ten", "tá")}, ${g("ktorý", "ktorá")} nás zachráni?“ Premeria si ťa od hlavy po päty. „Poď, ukážem ti dedinu.“`,
    ],
    [{ label: "Vstúpiť do Hôrky", action: () => go("dedina") }]
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
      text = [`Starosta Ondrej ťa objíme. „Si ${g("hrdina", "hrdinka")} Hôrky! Tvoje meno budú spievať ešte naši vnuci.“`];
    } else if (f.chiefDead && !f.towerKnown) {
      f.towerKnown = true;
      text = [
        "Ukážeš starostovi amulet, ktorý mal náčelník Gruzz na krku. Starosta zbledne.",
        "„To je znak Morventa – mága, ktorého sme pred rokmi vyhnali. Usadil sa v Zrúcanej veži za lesom. Goblini boli len jeho sluhovia. Ak chceš kliatbu zlomiť, musíš ísť za ním.“",
        "Starosta ti do dlane vloží 30 zlatých. „Na lepšiu výzbroj. Budeš ju potrebovať.“",
      ];
      state.gold += 30;
      log(`${g("Dostal", "Dostala")} si 30 zlatých. Objavená lokalita: Zrúcaná veža.`, "gold");
    } else if (f.towerKnown) {
      text = [`„Morvent čaká vo veži,“ hovorí starosta. „Choď, až budeš ${g("pripravený", "pripravená")}. A vezmi si elixíry.“`];
    } else if (f.caveKnown) {
      text = ["„Goblini zo Zubatej jaskyne kradnú naše ovce,“ vzdychá starosta. „Ich náčelník Gruzz má niečo spoločné s tým tieňom, som si istý.“"];
    } else {
      text = [
        `Starosta Ondrej je starý muž s unavenými očami. „Vďaka, že si ${g("prišiel", "prišla")},“ povie.`,
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
          log(`${g("Našiel", "Našla")} si zvláštny čierny amulet. Možno o ňom niečo vie starosta.`, "good");
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
        `„${g("Ďalší hrdina", "Ďalšia hrdinka")},“ zasyčí Morvent. „Hôrka ma vyhnala. Teraz bude patriť mne – navždy.“`,
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
  log(`${g("Vyspal", "Vyspala")} si sa v hostinci U Zlatého klasu. Zdravie a mana sú obnovené.`, "good");
  go("dedina");
}

function buy(key) {
  const it = ITEMS[key];
  if (state.gold < it.price) return;
  state.gold -= it.price;
  if (it.slot === "weapon") state.weapon = key;
  else if (it.slot === "armor") state.armor = key;
  else state.inv[key] = (state.inv[key] || 0) + 1;
  log(`${g("Kúpil", "Kúpila")} si: ${it.name}.`, "gold");
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
    const found = rand(3, 10);
    state.gold += found;
    log(`Pod koreňom starého duba si ${g("našiel", "našla")} mešec s ${found} zlatými.`, "gold");
    show([`${g("Narazil", "Narazila")} si na opustený tábor. V popole sa niečo zaleskne – mešec so zlatom!`],
      [{ label: "Pokračovať", action: () => go("les") }]);
  } else {
    const heal = rand(6, 12);
    state.hp = Math.min(state.maxHp, state.hp + heal);
    log(`${g("Natrhal", "Natrhala")} si liečivé byliny a ${g("obnovil", "obnovila")} ${heal} zdravia.`, "good");
    show(["Na čistinke rastú liečivé byliny. Rozžuješ pár lístkov a cítiš sa lepšie."],
      [{ label: "Pokračovať", action: () => go("les") }]);
  }
}

function exploreCave() {
  const f = state.flags;
  f.caveDepth = (f.caveDepth || 0) + 1;
  if (Math.random() < 0.15) {
    state.inv.liek = (state.inv.liek || 0) + 1;
    log(`V goblinskej skrýši si ${g("našiel", "našla")} Liečivý elixír.`, "good");
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
    const critChance = (state.cls === "zlodej" ? 0.25 : 0.1) + (attr("obratnost") - ATTR_BASE) * 0.03;
    const crit = Math.random() < critChance;
    const d = damage(totalAtk(), e.def, crit);
    e.hp -= d;
    lines.push(crit ? `Kritický zásah! ${g("Udelil", "Udelila")} si ${d} poškodenia.` : `${g("Zasiahol", "Zasiahla")} si nepriateľa za ${d}.`);
  } else if (action === "skill") {
    state.mp -= sk.cost;
    let d;
    if (state.cls === "bojovnik") d = damage(totalAtk(), e.def) * 2;
    else if (state.cls === "mag") d = totalAtk() + 8 + state.level * 2 + rand(0, 4);
    else d = damage(totalAtk(), e.def, true) + 2;
    d += attr("inteligencia") - ATTR_BASE;
    e.hp -= d;
    lines.push(`${sk.name}! ${g("Udelil", "Udelila")} si ${d} poškodenia.`);
  } else if (action === "defend") {
    combat.defending = true;
    const r = 2 + Math.floor(state.maxMp / 10);
    state.mp = Math.min(state.maxMp, state.mp + r);
    lines.push(`${g("Zaujal", "Zaujala")} si obranný postoj a ${g("sústredil", "sústredila")} sa (+${r} many).`);
  } else if (action === "potion") {
    state.inv.liek--;
    const before = state.hp;
    state.hp = Math.min(state.maxHp, state.hp + 20);
    lines.push(`${g("Vypil", "Vypila")} si liečivý elixír (+${state.hp - before} zdravia).`);
  } else if (action === "mana") {
    state.inv.mana--;
    const before = state.mp;
    state.mp = Math.min(state.maxMp, state.mp + 15);
    lines.push(`${g("Vypil", "Vypila")} si modrý elixír (+${state.mp - before} many).`);
  } else if (action === "flee") {
    if (Math.random() < 0.5 + attr("obratnost") * 0.05) {
      log("Podarilo sa ti utiecť.");
      combat = null;
      SCENES[state.scene]();
      return;
    }
    lines.push(`${g("Pokúsil", "Pokúsila")} si sa utiecť, ale nepriateľ ti zahradil cestu!`);
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
  log(`${g("Porazil", "Porazila")} si: ${e.name}. +${e.xp} skúseností, +${gold} zlatých.`, "gold");
  if (Math.random() < 0.2 && !e.final) {
    state.inv.liek = (state.inv.liek || 0) + 1;
    log("Nepriateľ mal pri sebe Liečivý elixír!", "good");
  }
  checkLevelUp();
  if (e.final) return onWin();
  show([`<span class="enemy">${e.name}</span> padol k zemi. ${g("Zvíťazil", "Zvíťazila")} si!`],
    [{ label: "Pokračovať", action: onWin }]);
}

function checkLevelUp() {
  while (state.xp >= xpNeeded(state.level)) {
    state.xp -= xpNeeded(state.level);
    state.level++;
    const gain = { bojovnik: [8, 2, 2, 1], mag: [5, 6, 1, 1], zlodej: [6, 3, 2, 1] }[state.cls];
    state.maxHp += gain[0];
    state.maxMp += gain[1];
    state.atk += gain[2];
    state.def += gain[3];
    state.hp = state.maxHp;
    state.mp = state.maxMp;
    log(`${g("Postúpil", "Postúpila")} si na úroveň ${state.level}! Si ${g("silnejší a plne zregenerovaný", "silnejšia a plne zregenerovaná")}.`, "good");
  }
}

function defeat() {
  combat = null;
  state.hp = 0;
  const hasSave = !!safeGet();
  show(
    [
      "Svet sa ti zatmie pred očami. Padáš na zem a tieň sa nad tebou zatvára…",
      `<strong>${g("Prehral", "Prehrala")} si.</strong>`,
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
      `<strong>Gratulujem, ${escapeHtml(state.name)}! ${g("Dohral", "Dohrala")} si hru na úrovni ${state.level}.</strong>`,
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
