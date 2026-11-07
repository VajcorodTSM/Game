"use strict";

/* =========================================================
   Tieň nad Hôrkou – textové RPG v štýle D&D
   Pravidlá sú zjednodušená verzia 5. edície podľa SRD 5.1
   (Wizards of the Coast, licencia CC BY 4.0).
   ========================================================= */

// =========================================================
// Kocky a pomocné funkcie
// =========================================================

const $ = (id) => document.getElementById(id);
const die = (sides) => 1 + Math.floor(Math.random() * sides);
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);
const mod = (score) => Math.floor((score - 10) / 2);
const clone = (o) => JSON.parse(JSON.stringify(o));

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function rollDice(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(die(sides));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

// Hod k20. mode > 0 = výhoda, mode < 0 = nevýhoda. Hráčovi pomáha rasová črta Šťastie.
function rollD20(mode = 0, player = false) {
  const one = () => {
    const v = die(20);
    if (player && v === 1 && hasTrait("stastie")) return { v: die(20), lucky: true };
    return { v, lucky: false };
  };
  const a = one();
  if (!mode) return { val: a.v, text: `k20: ${a.v}${a.lucky ? " (Šťastie prehodilo 1)" : ""}` };
  const b = one();
  const val = mode > 0 ? Math.max(a.v, b.v) : Math.min(a.v, b.v);
  const lucky = a.lucky || b.lucky ? ", Šťastie prehodilo 1" : "";
  return { val, text: `k20 s ${mode > 0 ? "výhodou" : "nevýhodou"} (${a.v} a ${b.v}${lucky}) → ${val}` };
}

// Výhoda a nevýhoda sa navzájom rušia.
const advMode = (adv, dis) => (adv && !dis ? 1 : dis && !adv ? -1 : 0);

// =========================================================
// Pravidlá: vlastnosti, zručnosti, rasy, povolania, pôvody
// =========================================================

const ABILITIES = {
  str: { name: "Sila", short: "SIL" },
  dex: { name: "Obratnosť", short: "OBR" },
  con: { name: "Odolnosť", short: "ODO" },
  int: { name: "Inteligencia", short: "INT" },
  wis: { name: "Múdrosť", short: "MÚD" },
  cha: { name: "Charizma", short: "CHA" },
};
const AB_KEYS = Object.keys(ABILITIES);

const SKILLS = {
  atletika: { name: "Atletika", ab: "str" },
  akrobacia: { name: "Akrobacia", ab: "dex" },
  nenapadnost: { name: "Nenápadnosť", ab: "dex" },
  arkana: { name: "Arkána", ab: "int" },
  historia: { name: "História", ab: "int" },
  nabozenstvo: { name: "Náboženstvo", ab: "int" },
  zvierata: { name: "Zaobchádzanie so zvieratami", ab: "wis" },
  vhlad: { name: "Vhľad", ab: "wis" },
  medicina: { name: "Medicína", ab: "wis" },
  vnimanie: { name: "Vnímanie", ab: "wis" },
  prezitie: { name: "Prežitie", ab: "wis" },
  klamanie: { name: "Klamanie", ab: "cha" },
  zastrasovanie: { name: "Zastrašovanie", ab: "cha" },
  vystupovanie: { name: "Vystupovanie", ab: "cha" },
  presviedcanie: { name: "Presviedčanie", ab: "cha" },
};

const DARKVISION = ["Tmavé videnie", "V tme vidíš ako v šere. V jaskyni sa zakrádaš bez fakle."];

const RACES = {
  clovek: {
    name: "Človek", nameF: "Človek",
    bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    desc: "Prispôsobiví a ctižiadostiví. Ľudia sú najrozšírenejším národom kraja.",
    traits: [["Všestrannosť", "+1 ku všetkým šiestim vlastnostiam."]],
    skills: [], flags: [],
  },
  elf: {
    name: "Elf", nameF: "Elfka",
    bonus: { dex: 2, int: 1 },
    desc: "Ladní a dlhovekí obyvatelia lesov so zmyslom pre mágiu.",
    traits: [DARKVISION, ["Bystré zmysly", "Zdatnosť vo Vnímaní."], ["Rodokmeň víl", "Výhoda na záchranné hody proti očareniu."]],
    skills: ["vnimanie"], flags: ["tmave_videnie", "proti_ocareniu"],
  },
  trpaslik: {
    name: "Trpaslík", nameF: "Trpaslíčka",
    bonus: { con: 2, wis: 1 },
    desc: "Húževnatý horský národ, tvrdý ako skala, z ktorej tesá svoje siene.",
    traits: [DARKVISION, ["Trpasličia odolnosť", "Výhoda na záchranné hody proti jedu a polovičné poškodenie jedom."], ["Trpasličia húževnatosť", "+1 život za každú úroveň."]],
    skills: [], flags: ["tmave_videnie", "proti_jedu", "huzevnatost"],
  },
  polovicnik: {
    name: "Polovičník", nameF: "Polovičníčka",
    bonus: { dex: 2, cha: 1 },
    desc: "Drobní, veselí a nečakane odvážni. Šťastena im praje.",
    traits: [["Šťastie", "Keď na k20 padne 1, hod sa zopakuje."], ["Statočnosť", "Výhoda na záchranné hody proti strachu."], ["Ľahkonohosť", "Zdatnosť v Nenápadnosti."]],
    skills: ["nenapadnost"], flags: ["stastie", "proti_strachu"],
  },
  polork: {
    name: "Polork", nameF: "Polorkyňa",
    bonus: { str: 2, con: 1 },
    desc: "Mocní potomkovia ľudí a orkov, ktorí sa len tak nevzdávajú.",
    traits: [DARKVISION, ["Hrozivý vzhľad", "Zdatnosť v Zastrašovaní."], ["Neúprosná vytrvalosť", "Raz za dlhý odpočinok klesneš na 1 život namiesto 0."], ["Divoké útoky", "Pri kritickom zásahu zbraňou hodíš jednu kocku poškodenia navyše."]],
    skills: ["zastrasovanie"], flags: ["tmave_videnie", "vytrvalost", "divoke_utoky"],
  },
  drakorodeny: {
    name: "Drakorodený", nameF: "Drakorodená",
    bonus: { str: 2, cha: 1 },
    desc: "Hrdí potomkovia drakov so šupinatou kožou farby medi.",
    traits: [["Dračí dych", "Raz za krátky odpočinok vydýchneš oheň: 2k6 (3k6 od 6. úrovne), úspešná záchrana na Obratnosť polovicu."], ["Dračia odolnosť", "Polovičné poškodenie ohňom."]],
    skills: [], flags: ["dych", "odolnost_ohen"],
  },
  gnom: {
    name: "Gnóm", nameF: "Gnómka",
    bonus: { int: 2, con: 1 },
    desc: "Zvedaví vynálezcovia a iluzionisti s nekonečnou energiou.",
    traits: [DARKVISION, ["Gnómia prefíkanosť", "Výhoda na záchranné hody na Inteligenciu, Múdrosť a Charizmu proti mágii."]],
    skills: [], flags: ["tmave_videnie", "prefikanost"],
  },
  tiefling: {
    name: "Tiefling", nameF: "Tieflingka",
    bonus: { cha: 2, int: 1 },
    desc: "Ľudia s krvou pekelných bytostí. Majú rohy, chvost a oči ako žeravé uhlíky.",
    traits: [DARKVISION, ["Pekelná odolnosť", "Polovičné poškodenie ohňom."], ["Pekelné pokarhanie", "Raz za dlhý odpočinok spáliš nepriateľa pekelným ohňom: 2k10, úspešná záchrana na Obratnosť polovicu."]],
    skills: [], flags: ["tmave_videnie", "odolnost_ohen", "pokarhanie"],
  },
};

const ARMOR = {
  ziadna: { name: "Bez zbroje", ac: (a) => 10 + mod(a.dex) },
  barbar: { name: "Bez zbroje (Obrana bez zbroje)", ac: (a) => 10 + mod(a.dex) + mod(a.con) },
  kozena: { name: "Kožená zbroj", ac: (a) => 11 + mod(a.dex) },
  kruzkova: { name: "Krúžková zbroj", ac: () => 16 },
  supinova: { name: "Šupinová zbroj a štít", ac: (a) => 14 + Math.min(2, mod(a.dex)) + 2 },
};

const CLASSES = {
  bojovnik: {
    name: "Bojovník", nameF: "Bojovníčka", hitDie: 10, primary: "Sila a Odolnosť",
    desc: "Majster zbraní a zbroje. Vydrží najviac a v boji je najspoľahlivejší.",
    saves: ["str", "con"], skillCount: 2,
    skillChoices: ["akrobacia", "atletika", "historia", "vhlad", "vnimanie", "prezitie", "zastrasovanie", "zvierata"],
    armor: "kruzkova", weapon: { name: "Dlhý meč (obojručne)", n: 1, s: 10, ab: "str", type: "sečné" },
    recommended: { str: 15, con: 14, dex: 13, wis: 12, cha: 10, int: 8 },
    features: [
      [1, "Bojový štýl: Obrana", "+1 k obrannému číslu, keď máš na sebe zbroj."],
      [1, "Druhý dych", "Bonusovou akciou si vyliečiš 1k10 + úroveň životov. Raz za krátky odpočinok."],
      [2, "Akčný nával", "Raz za krátky odpočinok získaš v ťahu jednu akciu navyše."],
      [5, "Útok navyše", "Akciou Útok zaútočíš dvakrát."],
    ],
  },
  barbar: {
    name: "Barbar", nameF: "Barbarka", hitDie: 12, primary: "Sila a Odolnosť",
    desc: "Divoký bojovník z hôr, ktorý čerpá silu zo zúrivosti.",
    saves: ["str", "con"], skillCount: 2,
    skillChoices: ["zvierata", "atletika", "zastrasovanie", "vnimanie", "prezitie"],
    armor: "barbar", weapon: { name: "Obojručná sekera", n: 1, s: 12, ab: "str", type: "sečné" },
    recommended: { str: 15, con: 14, dex: 13, wis: 12, cha: 10, int: 8 },
    features: [
      [1, "Zúrivosť", "Bonusovou akciou sa rozzúriš: do konca súboja +2 k poškodeniu zbraňou a polovičné sečné, bodné a drvivé poškodenie. 2× za dlhý odpočinok, od 3. úrovne 3×."],
      [1, "Obrana bez zbroje", "Obranné číslo = 10 + Obratnosť + Odolnosť."],
      [2, "Bezohľadný útok", "Útočíš s výhodou, ale nepriateľ má do tvojho ďalšieho ťahu výhodu proti tebe."],
      [5, "Útok navyše", "Akciou Útok zaútočíš dvakrát."],
    ],
  },
  tulak: {
    name: "Tulák", nameF: "Tuláčka", hitDie: 8, primary: "Obratnosť",
    desc: "Šikovný a nenápadný. Udrie tam, kde to najviac bolí.",
    saves: ["dex", "int"], skillCount: 4,
    skillChoices: ["akrobacia", "atletika", "klamanie", "vhlad", "zastrasovanie", "vnimanie", "vystupovanie", "presviedcanie", "nenapadnost"],
    armor: "kozena", weapon: { name: "Rapír", n: 1, s: 8, ab: "dex", type: "bodné" },
    recommended: { dex: 15, con: 14, wis: 13, cha: 12, int: 10, str: 8 },
    features: [
      [1, "Zákerný útok", "Keď útočíš s výhodou, pridáš 1k6 poškodenia. Každé 2 úrovne o 1k6 viac."],
      [1, "Zlodejské náradie", "Pri otváraní zámkov pridávaš zdatnostný bonus."],
      [1, "Skryť sa", "Akciou sa skúsiš skryť (Nenápadnosť). Ak uspeješ, ďalší útok máš s výhodou."],
      [2, "Prefíkaná akcia", "Skryť sa môžeš aj bonusovou akciou."],
      [5, "Neuveriteľný únik", "Raz za súboj si polovičíš poškodenie z jedného zásahu."],
    ],
  },
  mag: {
    name: "Mág", nameF: "Mágička", hitDie: 6, primary: "Inteligencia",
    desc: "Učenec tajomných síl. Je krehký, ale jeho kúzla menia priebeh boja.",
    saves: ["int", "wis"], skillCount: 2,
    skillChoices: ["arkana", "historia", "vhlad", "medicina", "nabozenstvo"],
    armor: "ziadna", weapon: { name: "Palica", n: 1, s: 6, ab: "str", type: "drvivé" },
    caster: { ab: "int", table: "full" },
    spells: { 0: ["ohnivy_sip"], 1: ["magicka_strela", "brnenie_maga"], 3: ["spalujuci_luc"], 5: ["ohniva_gula"] },
    recommended: { int: 15, con: 14, dex: 13, wis: 12, cha: 10, str: 8 },
    features: [
      [1, "Zosielanie kúziel", "Kúzla zosielaš Inteligenciou. Sloty kúziel sa obnovia po dlhom odpočinku."],
      [1, "Arkánne zotavenie", "Raz za deň ti krátky odpočinok vráti jeden minutý slot kúziel."],
    ],
  },
  knaz: {
    name: "Kňaz", nameF: "Kňažka", hitDie: 8, primary: "Múdrosť",
    desc: "Služobník Svetla. Lieči rany a spaľuje nemŕtvych.",
    saves: ["wis", "cha"], skillCount: 2,
    skillChoices: ["historia", "vhlad", "medicina", "presviedcanie", "nabozenstvo"],
    armor: "supinova", weapon: { name: "Palcát", n: 1, s: 6, ab: "str", type: "drvivé" },
    caster: { ab: "wis", table: "full" },
    spells: { 0: ["posvatny_plamen"], 1: ["liecenie_ran", "navadzana_strela"], 3: ["duchovna_zbran"], 5: ["duchovni_strazcovia"] },
    recommended: { wis: 15, con: 14, str: 13, dex: 12, cha: 10, int: 8 },
    features: [
      [1, "Zosielanie kúziel", "Kúzla zosielaš Múdrosťou. Sloty kúziel sa obnovia po dlhom odpočinku."],
      [1, "Doména života", "Liečivé kúzla ti vrátia o 2 + úroveň slotu životov navyše."],
      [2, "Odvrátenie nemŕtvych", "Raz za krátky odpočinok predvedieš svätý symbol. Nemŕtvy, ktorý neuspeje pri záchrane na Múdrosť, sa 2 kolá krčí v hrôze."],
    ],
  },
  hranicar: {
    name: "Hraničiar", nameF: "Hraničiarka", hitDie: 10, primary: "Obratnosť a Múdrosť",
    desc: "Stopár a lukostrelec z divočiny. Vie, kde a ako lovia beštie.",
    saves: ["str", "dex"], skillCount: 3,
    skillChoices: ["zvierata", "atletika", "vhlad", "vnimanie", "prezitie", "nenapadnost"],
    armor: "kozena", weapon: { name: "Dlhý luk", n: 1, s: 8, ab: "dex", type: "bodné", ranged: true },
    caster: { ab: "wis", table: "half" },
    spells: { 2: ["lovcova_znacka", "liecenie_ran"] },
    recommended: { dex: 15, wis: 14, con: 13, str: 12, int: 10, cha: 8 },
    features: [
      [1, "Obľúbený nepriateľ: zvery", "Výhoda pri stopovaní a +2 k poškodeniu proti zverom."],
      [1, "Bojový štýl: Lukostreľba", "+2 k hodu na útok strelnou zbraňou."],
      [2, "Zosielanie kúziel", "Kúzla zosielaš Múdrosťou."],
      [5, "Útok navyše", "Akciou Útok zaútočíš dvakrát."],
    ],
  },
};

const BACKGROUNDS = {
  vojak: {
    name: "Vojak", skills: ["atletika", "zastrasovanie"], gold: 10, items: { elixir: 1 },
    desc: "Roky v kráľovskom vojsku ťa naučili disciplíne a boju v šíku.",
    feature: ["Vojenská hodnosť", "Začínaš s elixírom liečenia navyše z vojenských zásob."],
  },
  akolyta: {
    name: "Akolyta", skills: ["vhlad", "nabozenstvo"], gold: 5, items: { voda: 2 },
    desc: "Vyrastanie v chráme Svetla ťa naučilo modlitbám a obradom.",
    feature: ["Útočisko veriacich", "Chrám ti pomôže v núdzi: oživenie po smrti stojí len polovicu zlata. Začínaš s dvomi fľaštičkami svätenej vody."],
  },
  kriminalnik: {
    name: "Kriminálnik", skills: ["klamanie", "nenapadnost"], gold: 15, items: {},
    desc: "Život na okraji zákona. Poznáš ľudí, o ktorých sa nahlas nehovorí.",
    feature: ["Kontakt v podsvetí", "V obchode nakupuješ o 20 % lacnejšie."],
  },
  mudrc: {
    name: "Mudrc", skills: ["arkana", "historia"], gold: 10, items: {},
    desc: "Strávil si roky nad starými knihami v knižniciach a archívoch.",
    descF: "Strávila si roky nad starými knihami v knižniciach a archívoch.",
    feature: ["Výskumník", "Pri hodoch na Arkánu a Históriu máš výhodu."],
  },
  ludovy_hrdina: {
    name: "Ľudový hrdina", skills: ["zvierata", "prezitie"], gold: 10, items: {},
    desc: "Pochádzaš z prostých ľudí a raz si sa postavil tyranovi. Na vidieku ťa majú radi.",
    descF: "Pochádzaš z prostých ľudí a raz si sa postavila tyranovi. Na vidieku ťa majú radi.",
    feature: ["Pohostinnosť prostých ľudí", "Nocľah v hostinci máš zadarmo."],
  },
  slachtic: {
    name: "Šľachtic", skills: ["historia", "presviedcanie"], gold: 50, items: {},
    desc: "Pochádzaš zo zámožného rodu. Vieš, ako sa správať pred mocnými.",
    feature: ["Výsada postavenia", "Starosta ti za splnenú úlohu zaplatí o polovicu viac."],
  },
};

const ALIGNMENTS = {
  ZD: "Zákonné dobro", ND: "Neutrálne dobro", CD: "Chaotické dobro",
  ZN: "Zákonná neutralita", N: "Neutralita", CN: "Chaotická neutralita",
  ZZ: "Zákonné zlo", NZ: "Neutrálne zlo", CZ: "Chaotické zlo",
};

const SPELLS = {
  ohnivy_sip: { name: "Ohnivý šíp", level: 0, desc: "Útok kúzlom: 1k10 ohňom (od 5. úrovne 2k10)." },
  posvatny_plamen: { name: "Posvätný plameň", level: 0, desc: "Nepriateľ si hodí záchranu na Obratnosť. Ak neuspeje, utrpí 1k8 žiarivého poškodenia (od 5. úrovne 2k8)." },
  magicka_strela: { name: "Magická strela", level: 1, desc: "Tri žiariace šípky, každá 1k4+1 silovým poškodením. Vždy zasiahnu. Vyšší slot pridá šípku." },
  brnenie_maga: { name: "Brnenie mága", level: 1, outOfCombat: true, desc: "Mimo boja: obranné číslo 13 + Obratnosť až do dlhého odpočinku." },
  spalujuci_luc: { name: "Spaľujúci lúč", level: 2, desc: "Tri ohnivé lúče. Každý je útok kúzlom za 2k6 ohňom." },
  ohniva_gula: { name: "Ohnivá guľa", level: 3, desc: "Výbuch ohňa za 8k6. Úspešná záchrana na Obratnosť polovicu." },
  liecenie_ran: { name: "Liečenie rán", level: 1, heal: true, desc: "Vyliečiš si 1k8 + modifikátor kúzla životov. Vyšší slot pridá 1k8." },
  navadzana_strela: { name: "Navádzaná strela", level: 1, desc: "Útok kúzlom: 4k6 žiarivého poškodenia a ďalší útok proti cieľu má výhodu." },
  duchovna_zbran: { name: "Duchovná zbraň", level: 2, bonus: true, desc: "Bonusová akcia: privoláš lietajúci palcát zo svetla. Hneď zaútočí (1k8 + Múdrosť) a v ďalších kolách útočí bonusovou akciou." },
  duchovni_strazcovia: { name: "Duchovní strážcovia", level: 3, desc: "Strážni duchovia ťa obklopia. Na začiatku každého ťahu nepriateľa mu spôsobia 3k8 žiarivého poškodenia, úspešná záchrana na Múdrosť polovicu." },
  lovcova_znacka: { name: "Lovcova značka", level: 1, bonus: true, desc: "Bonusová akcia: označíš korisť. Do konca súboja každý zásah zbraňou pridá 1k6." },
};

const FULL_SLOTS = { 1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3] };
const HALF_SLOTS = { 1: [], 2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2] };
const XP_LEVELS = [0, 0, 300, 900, 1800, 3000, 4500];
const MAX_LEVEL = 6;
const PHYSICAL = ["sečné", "bodné", "drvivé"];

const ITEMS = {
  elixir: { name: "Elixír liečenia", price: 25, desc: "Obnoví 2k4+2 životov. Vypiť ho je bonusová akcia." },
  velky: { name: "Väčší elixír liečenia", price: 60, desc: "Obnoví 4k4+4 životov." },
  voda: { name: "Svätená voda", price: 20, desc: "Hodíš ju na nemŕtveho: 2k6 žiarivého poškodenia." },
};
const UPGRADES = {
  zbran: { name: "Kováčska úprava zbrane (+1)", price: 100, desc: "+1 k útoku a poškodeniu zbraňou." },
  zbroj: { name: "Vystuženie zbroje (+1)", price: 120, desc: "+1 k obrannému číslu." },
};

// =========================================================
// Nepriatelia
// =========================================================

const ENEMIES = {
  vlk: { name: "Vlk", ac: 13, hp: 11, atk: 4, dmg: [2, 4, 2], dtype: "bodné", init: 2, sv: { dex: 2, wis: 1 }, xp: 50, gold: [0, 2], tags: ["zviera"], onHit: "zrazenie" },
  goblin: { name: "Goblin", ac: 15, hp: 7, atk: 4, dmg: [1, 6, 2], dtype: "sečné", init: 2, sv: { dex: 2 }, xp: 50, gold: [2, 8], tags: ["humanoid"] },
  netopier: { name: "Obrovský netopier", ac: 13, hp: 18, atk: 4, dmg: [1, 6, 2], dtype: "bodné", init: 3, sv: { dex: 3, wis: 1 }, xp: 50, gold: [0, 0], tags: ["zviera"] },
  pavuk: { name: "Obrovský pavúk", ac: 14, hp: 24, atk: 5, dmg: [1, 8, 3], dtype: "bodné", init: 3, sv: { dex: 3 }, xp: 200, gold: [0, 5], tags: ["zviera"], onHit: "jed" },
  zbojnik: { name: "Zbojnícky veterán", ac: 14, hp: 30, atk: 5, dmg: [1, 8, 3], dtype: "sečné", init: 1, sv: { str: 3, con: 2 }, xp: 200, gold: [10, 25], tags: ["humanoid"] },
  gruzz: { name: "Goblinský náčelník Gruzz", ac: 16, hp: 40, atk: 5, dmg: [2, 6, 2], dtype: "drvivé", init: 2, sv: { str: 2, dex: 2 }, xp: 700, gold: [60, 80], tags: ["humanoid"], boss: true, special: "gruzz" },
  kostlivec: { name: "Kostlivý strážca", ac: 13, hp: 30, atk: 5, dmg: [1, 10, 3], dtype: "sečné", init: 2, sv: { dex: 2 }, xp: 300, gold: [10, 20], tags: ["nemŕtvy"], vuln: ["drvivé"] },
  prizrak: { name: "Bledý prízrak", ac: 13, hp: 42, atk: 6, dmg: [3, 6, 0], dtype: "nekrotické", init: 3, sv: { dex: 3, wis: 2 }, xp: 450, gold: [15, 30], tags: ["nemŕtvy"], special: "prizrak" },
  morvent: { name: "Tieňový mág Morvent", ac: 15, hp: 80, atk: 7, dmg: [3, 8, 0], dtype: "nekrotické", init: 2, sv: { dex: 2, con: 1, int: 5, wis: 4 }, xp: 1000, gold: [0, 0], tags: ["humanoid"], boss: true, final: true, special: "morvent" },
};

// =========================================================
// Odvodené hodnoty postavy
// =========================================================

let state = null;   // práve hraná postava
let combat = null;  // prebiehajúci súboj
let notes = [];     // výsledky hodov, ktoré sa ukážu pri najbližšom vykreslení

const g = (m, f) => (state && state.gender === "f" ? f : m);
const gs = (s, m, f) => (s.gender === "f" ? f : m);
const hasTrait = (flag, s = state) => !!s && RACES[s.race].flags.includes(flag);
const raceName = (s = state) => gs(s, RACES[s.race].name, RACES[s.race].nameF);
const className = (s = state) => gs(s, CLASSES[s.cls].name, CLASSES[s.cls].nameF);
const prof = (s = state) => (s.level >= 5 ? 3 : 2);
const abMod = (ab, s = state) => mod(s.abil[ab]);
const isProf = (skill, s = state) => s.skills.includes(skill);

function skillBonus(skill, s = state) {
  return abMod(SKILLS[skill].ab, s) + (isProf(skill, s) ? prof(s) : 0);
}
function saveBonus(ab, s = state) {
  return abMod(ab, s) + (CLASSES[s.cls].saves.includes(ab) ? prof(s) : 0);
}
function armorClass(s = state) {
  const cls = CLASSES[s.cls];
  let ac = ARMOR[cls.armor].ac(s.abil);
  if (s.cls === "mag" && s.mageArmor) ac = Math.max(ac, 13 + abMod("dex", s));
  if (s.cls === "bojovnik") ac += 1;
  return ac + (s.armorPlus || 0);
}
function weaponAb(s = state) { return CLASSES[s.cls].weapon.ab; }
function weaponAttackBonus(s = state) {
  const w = CLASSES[s.cls].weapon;
  return prof(s) + abMod(w.ab, s) + (s.weaponPlus || 0) + (w.ranged && s.cls === "hranicar" ? 2 : 0);
}
function weaponDamageText(s = state) {
  const w = CLASSES[s.cls].weapon;
  const b = abMod(w.ab, s) + (s.weaponPlus || 0);
  return `${w.n}k${w.s}${b ? fmtMod(b) : ""} ${w.type}`;
}
function casterAb(s = state) { const c = CLASSES[s.cls].caster; return c ? c.ab : null; }
function spellAttackBonus(s = state) { return prof(s) + abMod(casterAb(s), s); }
function spellDC(s = state) { return 8 + prof(s) + abMod(casterAb(s), s); }
function maxSlots(s = state) {
  const c = CLASSES[s.cls].caster;
  if (!c) return [];
  return (c.table === "full" ? FULL_SLOTS : HALF_SLOTS)[s.level].slice();
}
function knownSpells(s = state) {
  const sp = CLASSES[s.cls].spells || {};
  return Object.keys(sp).filter((lvl) => Number(lvl) <= s.level).flatMap((lvl) => sp[lvl]);
}
function extraAttack(s = state) { return s.level >= 5 && ["bojovnik", "barbar", "hranicar"].includes(s.cls); }
function sneakDice(s = state) { return Math.ceil(s.level / 2); }
function hpPerLevel(s = state) {
  return Math.max(1, CLASSES[s.cls].hitDie / 2 + 1 + abMod("con", s)) + (hasTrait("huzevnatost", s) ? 1 : 0);
}
function resMax(key, s = state) {
  switch (key) {
    case "druhyDych": return s.cls === "bojovnik" ? 1 : 0;
    case "akcnyNaval": return s.cls === "bojovnik" && s.level >= 2 ? 1 : 0;
    case "zurivost": return s.cls === "barbar" ? (s.level >= 3 ? 3 : 2) : 0;
    case "odvratenie": return s.cls === "knaz" && s.level >= 2 ? 1 : 0;
    case "dych": return hasTrait("dych", s) ? 1 : 0;
    case "pokarhanie": return hasTrait("pokarhanie", s) ? 1 : 0;
    case "vytrvalost": return hasTrait("vytrvalost", s) ? 1 : 0;
    case "arkanne": return s.cls === "mag" ? 1 : 0;
    default: return 0;
  }
}
const RES_KEYS = ["druhyDych", "akcnyNaval", "zurivost", "odvratenie", "dych", "pokarhanie", "vytrvalost", "arkanne"];
const SHORT_RES = ["druhyDych", "akcnyNaval", "odvratenie", "dych"];
const RES_NAMES = {
  druhyDych: "Druhý dych", akcnyNaval: "Akčný nával", zurivost: "Zúrivosť", odvratenie: "Odvrátenie nemŕtvych",
  dych: "Dračí dych", pokarhanie: "Pekelné pokarhanie", vytrvalost: "Neúprosná vytrvalosť", arkanne: "Arkánne zotavenie",
};

function buildCharacter(w) {
  const race = RACES[w.race];
  const cls = CLASSES[w.cls];
  const bg = BACKGROUNDS[w.background];
  const base = wizardBase(w);
  const abil = {};
  AB_KEYS.forEach((k) => { abil[k] = base[k] + (race.bonus[k] || 0); });
  const skills = [...new Set([...race.skills, ...w.skills, ...bg.skills])];
  const s = {
    v: 2, slot: w.slot, created: Date.now(),
    name: w.name.trim() || (w.gender === "f" ? "Pocestná" : "Pocestný"),
    gender: w.gender, race: w.race, cls: w.cls, background: w.background, alignment: w.alignment,
    abil, skills, level: 1, xp: 0,
    gold: 15 + bg.gold,
    inv: { elixir: 1 + (bg.items.elixir || 0), velky: 0, voda: bg.items.voda || 0 },
    weaponPlus: 0, armorPlus: 0, mageArmor: false,
    scene: "prichod", flags: {}, res: {},
  };
  s.maxHp = cls.hitDie + mod(abil.con) + (hasTrait("huzevnatost", s) ? 1 : 0);
  s.hp = s.maxHp;
  s.hitDice = 1;
  s.slots = maxSlots(s);
  RES_KEYS.forEach((k) => { s.res[k] = resMax(k, s); });
  return s;
}

// =========================================================
// Hody mimo boja: zručnosti a záchranné hody
// =========================================================

function note(text, cls = "") {
  log(text, cls);
  notes.push({ text, cls });
}

function skillCheck(skill, dc, opts = {}) {
  const sk = SKILLS[skill];
  let adv = !!opts.adv;
  const dis = !!opts.dis;
  if (state.background === "mudrc" && (skill === "arkana" || skill === "historia")) adv = true;
  const r = rollD20(advMode(adv, dis), true);
  const bonus = skillBonus(skill) + (opts.extra || 0);
  const total = r.val + bonus;
  const ok = total >= dc;
  note(`${sk.name}: ${r.text} ${fmtMod(bonus)} = ${total} proti SO ${dc} → ${ok ? "úspech" : "neúspech"}`, ok ? "good" : "bad");
  return ok;
}

function playerSave(ab, dc, opts = {}) {
  const r = rollD20(advMode(!!opts.adv, !!opts.dis), true);
  const bonus = saveBonus(ab);
  const total = r.val + bonus;
  const ok = total >= dc;
  note(`Záchranný hod na ${ABILITIES[ab].name}: ${r.text} ${fmtMod(bonus)} = ${total} proti SO ${dc} → ${ok ? "úspech" : "neúspech"}`, ok ? "good" : "bad");
  return ok;
}

function heal(amount, source) {
  const before = state.hp;
  state.hp = Math.min(state.maxHp, state.hp + amount);
  note(`${source}: +${state.hp - before} životov (${state.hp}/${state.maxHp}).`, "good");
}

function hurtPlayer(amount, type, what) {
  let final = amount;
  const why = [];
  if (combat && combat.cond.rage && PHYSICAL.includes(type)) { final = Math.floor(final / 2); why.push("zúrivosť"); }
  if (type === "oheň" && hasTrait("odolnost_ohen")) { final = Math.floor(final / 2); why.push("odolnosť voči ohňu"); }
  if (type === "jed" && hasTrait("proti_jedu")) { final = Math.floor(final / 2); why.push("trpasličia odolnosť"); }
  if (combat && state.cls === "tulak" && state.level >= 5 && !combat.uncanny && final >= 6) {
    combat.uncanny = true;
    final = Math.floor(final / 2);
    why.push("neuveriteľný únik");
  }
  state.hp -= final;
  note(`${what}: ${final} (${type})${why.length ? `, polovičné vďaka: ${why.join(", ")}` : ""}. Životy ${Math.max(0, state.hp)}/${state.maxHp}.`, "bad");
}

// Vráti true, ak polorka zachránila Neúprosná vytrvalosť.
function tryRelentless() {
  if (state.hp > 0) return true;
  if (state.res.vytrvalost > 0) {
    state.res.vytrvalost--;
    state.hp = 1;
    note("Neúprosná vytrvalosť! Odmietaš padnúť a zostávaš stáť s 1 životom.", "good");
    return true;
  }
  return false;
}

function grantXp(n) {
  state.xp += n;
}
function canLevelUp() {
  return state.level < MAX_LEVEL && state.xp >= XP_LEVELS[state.level + 1];
}

// =========================================================
// Úložisko: účet claude.ai (db) alebo toto zariadenie
// =========================================================

const SLOTS = ["postava-1", "postava-2", "postava-3"];

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch { /* nič */ } }

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej({ code: "timeout" }), ms))]);
}

const Store = {
  mode: null,       // "cloud" alebo "local"
  account: "",      // meno hráča v lokálnom režime
  displayName: "",
  db: null,
  uid: null,
  key(slot) { return `tnh2:${this.account.toLowerCase()}:${slot}`; },
  async list() {
    if (this.mode === "cloud") {
      const snap = await withTimeout(this.db.collection(`data/users/${this.uid}`).get(), 10000);
      return snap.docs.filter((d) => d.exists && SLOTS.includes(d.id)).map((d) => clone(d.data()));
    }
    const out = [];
    for (const slot of SLOTS) {
      const raw = lsGet(this.key(slot));
      if (!raw) continue;
      try { out.push(JSON.parse(raw)); } catch { /* poškodený záznam preskočíme */ }
    }
    return out;
  },
  async save(ch) {
    if (this.mode === "cloud") return this.db.collection(`data/users/${this.uid}`).doc(ch.slot).set(ch);
    if (!lsSet(this.key(ch.slot), JSON.stringify(ch))) throw new Error("storage");
  },
  async remove(slot) {
    if (this.mode === "cloud") return this.db.collection(`data/users/${this.uid}`).doc(slot).delete();
    lsDel(this.key(slot));
  },
};

let saving = false;
let pendingSave = null;

function queueSave() {
  if (!state || !Store.mode) return;
  pendingSave = clone(state);
  if (!saving) flushSave();
}
async function flushSave() {
  saving = true;
  setSaveStatus("Ukladám…");
  let failed = false;
  while (pendingSave) {
    const data = pendingSave;
    pendingSave = null;
    try { await Store.save(data); } catch { failed = true; }
  }
  saving = false;
  setSaveStatus(failed ? "Uloženie zlyhalo. Skús pokračovať, uložím znova." : "Uložené", failed);
}
function setSaveStatus(text, bad = false) {
  const el = $("save-status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("bad", bad);
}

// Prihlásenie cez účet claude.ai, ak stránka beží na claude.ai.
let cloudAccount = null;
let cloudChecked = false;

async function detectCloudAccount() {
  try {
    if (!window.claude || typeof window.claude.use !== "function") return null;
    const [user, db] = await Promise.all([window.claude.use("user"), window.claude.use("db")]);
    if (!user || !db) return null;
    const me = await user.me();
    if (!me || !me.id) return null;
    return { db, id: me.id, name: me.name || "" };
  } catch {
    return null;
  }
}

// =========================================================
// Vykresľovanie
// =========================================================

let screen = "login";

function log(msg, cls = "") {
  const d = document.createElement("div");
  d.textContent = msg;
  if (cls) d.className = cls;
  $("log").prepend(d);
  while ($("log").childElementCount > 120) $("log").lastChild.remove();
}

function notesHtml() {
  if (!notes.length) return "";
  const html = `<div class="rolls">${notes.map((n) => `<div class="${n.cls}">${escapeHtml(n.text)}</div>`).join("")}</div>`;
  notes = [];
  return html;
}

function show(paragraphs, choices) {
  $("story").innerHTML = notesHtml() + paragraphs.map((p) => (p.startsWith("<div") ? p : `<p>${p}</p>`)).join("");
  $("story").onclick = null;
  $("story").onchange = null;
  $("story").oninput = null;
  renderChoices(choices);
  renderStats();
  renderMenu();
}

function renderChoices(choices) {
  const box = $("choices");
  box.innerHTML = "";
  for (const ch of choices) {
    if (ch.heading) {
      const h = document.createElement("div");
      h.className = "choice-heading";
      h.textContent = ch.heading;
      box.appendChild(h);
      continue;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = ch.label;
    if (ch.cls) b.className = ch.cls;
    if (ch.disabled) b.disabled = true;
    b.addEventListener("click", ch.action);
    box.appendChild(b);
  }
}

function bar(cur, max, cls) {
  const pct = Math.max(0, Math.min(100, (cur / max) * 100));
  return `<div class="bar ${cls}"><span style="width:${pct}%"></span></div>`;
}

function renderStats() {
  const el = $("stats");
  if (!state || screen !== "game") { el.innerHTML = ""; return; }
  const s = state;
  const next = s.level < MAX_LEVEL ? XP_LEVELS[s.level + 1] : null;
  const slots = maxSlots();
  const slotHtml = slots.length
    ? `<div>Sloty kúziel: ${slots.map((m, i) => `<span class="slot-group">${i + 1}. ${"●".repeat(s.slots[i] || 0)}${"○".repeat(Math.max(0, m - (s.slots[i] || 0)))}</span>`).join(" ")}</div>`
    : "";
  el.innerHTML = `
    <div class="stat-row">
      <div><strong>${escapeHtml(s.name)}</strong> <span class="muted">${raceName()} · ${className()} ${s.level}. úrovne</span></div>
      <div>OČ <b>${armorClass()}</b> · Zlato <span class="gold-text">${s.gold}</span></div>
    </div>
    <div class="stat-row">
      <div>Životy ${Math.max(0, s.hp)}/${s.maxHp}${bar(s.hp, s.maxHp, "hp")}</div>
      <div>Skúsenosti ${s.xp}${next ? `/${next}` : ""}${next ? bar(s.xp - XP_LEVELS[s.level], next - XP_LEVELS[s.level], "xp") : ""}</div>
    </div>
    <div class="stat-row muted small">
      ${slotHtml}
      <div>Elixíry ${s.inv.elixir || 0}${s.inv.velky ? ` + ${s.inv.velky} väčšie` : ""}${s.inv.voda ? ` · Svätená voda ${s.inv.voda}` : ""}</div>
    </div>`;
}

function renderMenu() {
  const menu = $("menu");
  menu.innerHTML = "";
  const add = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", fn);
    menu.appendChild(b);
  };
  if (screen === "game" && !combat) add("Denník postavy", showSheet);
  if (screen === "game" || screen === "wizard") add("Moje postavy", () => { if (screen === "game") queueSave(); openCharacterList(); });
  if (screen !== "login") add("Odhlásiť sa", logout);
  const acc = $("account");
  if (screen === "login") acc.textContent = "";
  else acc.textContent = Store.mode === "cloud"
    ? `Prihlásený účet: ${Store.displayName || "claude.ai"}`
    : `Hráč: ${Store.account}`;
  $("save-status").hidden = screen !== "game";
}

// =========================================================
// Prihlásenie
// =========================================================

function showLogin() {
  screen = "login";
  state = null;
  combat = null;
  wiz = null;
  const last = lsGet("tnh2:lastAccount") || "";
  const cloudPart = !cloudChecked
    ? `<p class="muted small">Overujem, či si prihlásený cez claude.ai…</p>`
    : cloudAccount
      ? `<div class="login-cloud">
          <p>Si prihlásený cez claude.ai${cloudAccount.name ? ` ako <strong id="cloud-name"></strong>` : ""}. Postavy sa uložia k tvojmu účtu a nájdeš ich na každom zariadení.</p>
          <button type="button" class="primary" id="btn-cloud">Pokračovať s účtom claude.ai</button>
        </div>
        <p class="muted small">Alebo hraj pod menom hráča. Postavy sa potom uložia len v tomto prehliadači.</p>`
      : `<p class="muted small">Zadaj meno hráča. Tvoje postavy sa uložia v tomto prehliadači pod týmto menom.</p>`;

  $("story").innerHTML = `
    <div class="login">
      <p>Dedinku Hôrka už tri mesiace zahaľuje zvláštny tieň. Úroda hnije, studne sú kalné a v noci z lesa počuť šepot. Starosta rozposlal poslov do širokého okolia: kto zbaví Hôrku kliatby, toho odmení.</p>
      <h2>Prihlásenie</h2>
      ${cloudPart}
      <form id="login-form" class="login-form" autocomplete="off">
        <label for="login-name">Meno hráča</label>
        <div class="login-row">
          <input id="login-name" class="text-input" maxlength="24" value="${escapeHtml(last)}" placeholder="napr. Peter">
          <button type="submit" id="btn-local">Prihlásiť sa</button>
        </div>
        <p class="error" id="login-error" hidden>Zadaj meno hráča (aspoň 2 znaky).</p>
      </form>
    </div>`;
  if (cloudAccount && cloudAccount.name) $("cloud-name").textContent = cloudAccount.name;
  $("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("login-name").value.trim();
    if (name.length < 2) { $("login-error").hidden = false; return; }
    lsSet("tnh2:lastAccount", name);
    Store.mode = "local";
    Store.account = name;
    Store.displayName = name;
    log(`Prihlásený hráč: ${name}`, "good");
    openCharacterList();
  });
  if (cloudAccount) {
    $("btn-cloud").addEventListener("click", () => {
      Store.mode = "cloud";
      Store.db = cloudAccount.db;
      Store.uid = cloudAccount.id;
      Store.displayName = cloudAccount.name;
      log("Prihlásenie cez claude.ai.", "good");
      openCharacterList();
    });
  }
  $("choices").innerHTML = "";
  renderStats();
  renderMenu();
}

function logout() {
  if (screen === "game") queueSave();
  Store.mode = null;
  Store.account = "";
  $("log").innerHTML = "";
  showLogin();
}

// =========================================================
// Moje postavy
// =========================================================

const SCENE_NAMES = {
  prichod: "Cesta do Hôrky", dedina: "Hôrka", starosta: "Hôrka", obchod: "Hôrka", hostinec: "Hôrka", priprava: "Hôrka",
  les: "Šepkavý les", jaskyna: "Zubatá jaskyňa", gruzz: "Zubatá jaskyňa", veza: "Zrúcaná veža", morvent: "Vrchol veže", koniec: "Dobrodružstvo dokončené",
};

let deleteArmed = null;

async function openCharacterList() {
  screen = "list";
  state = null;
  combat = null;
  wiz = null;
  show(["<div class=\"muted\">Načítavam postavy…</div>"], []);
  let chars;
  try {
    chars = await Store.list();
  } catch {
    show(["Postavy sa nepodarilo načítať. Skontroluj pripojenie na internet a skús to znova."],
      [{ label: "Skúsiť znova", action: openCharacterList }]);
    return;
  }
  if (screen !== "list") return;
  const bySlot = Object.fromEntries(chars.map((c) => [c.slot, c]));
  const cards = SLOTS.map((slot, i) => {
    const c = bySlot[slot];
    if (!c) {
      return `<div class="char-card empty">
        <div><strong>${i + 1}. voľné miesto</strong><div class="muted small">Sem môžeš vytvoriť novú postavu.</div></div>
        <div class="char-actions"><button type="button" class="primary" data-new="${slot}">Vytvoriť postavu</button></div>
      </div>`;
    }
    const where = c.flags && c.flags.won ? "Dobrodružstvo dokončené" : SCENE_NAMES[c.scene] || "Hôrka";
    const armed = deleteArmed === slot;
    return `<div class="char-card">
      <div>
        <strong>${escapeHtml(c.name)}</strong>
        <div class="muted small">${gs(c, RACES[c.race].name, RACES[c.race].nameF)} · ${gs(c, CLASSES[c.cls].name, CLASSES[c.cls].nameF)} ${c.level}. úrovne · ${BACKGROUNDS[c.background].name}</div>
        <div class="muted small">${where} · Životy ${Math.max(0, c.hp)}/${c.maxHp} · ${c.gold} zl</div>
      </div>
      <div class="char-actions">
        <button type="button" class="primary" data-play="${slot}">Hrať</button>
        <button type="button" class="${armed ? "danger" : ""}" data-del="${slot}">${armed ? "Naozaj zmazať?" : "Zmazať"}</button>
      </div>
    </div>`;
  }).join("");

  show([`<div class="list-head"><h2>Moje postavy</h2><p class="muted small">Môžeš mať až tri postavy. Hra sa ukladá sama pri každom presune.</p></div><div class="char-list">${cards}</div>`], []);
  $("story").onclick = async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.new) { deleteArmed = null; startWizard(t.dataset.new); }
    if (t.dataset.play) { deleteArmed = null; playCharacter(bySlot[t.dataset.play]); }
    if (t.dataset.del) {
      const slot = t.dataset.del;
      if (deleteArmed !== slot) { deleteArmed = slot; openCharacterList(); return; }
      deleteArmed = null;
      try { await Store.remove(slot); log("Postava bola zmazaná.", "bad"); } catch { log("Postavu sa nepodarilo zmazať.", "bad"); }
      openCharacterList();
    }
  };
}

function playCharacter(c) {
  state = c;
  combat = null;
  screen = "game";
  state.flags = state.flags || {};
  log(`${state.name} pokračuje v dobrodružstve.`, "good");
  go(SCENES[state.scene] ? state.scene : "dedina");
}

// =========================================================
// Tvorba postavy: Rasa → Povolanie → Vlastnosti → Pôvod → Identita → Súhrn
// =========================================================

const WIZ_STEPS = ["Rasa", "Povolanie", "Vlastnosti", "Pôvod", "Identita", "Súhrn"];
const PB_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const PB_TOTAL = 27;
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
let wiz = null;

function startWizard(slot) {
  screen = "wizard";
  wiz = {
    slot, step: 0, maxStep: 0,
    race: null, cls: null, skills: [],
    method: "pointbuy",
    pb: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    pool: STANDARD_ARRAY.slice(), rolls: null, assign: null,
    background: null, name: "", gender: "m", alignment: "N",
  };
  renderWizard();
}

function pbLeft(w = wiz) {
  return PB_TOTAL - AB_KEYS.reduce((a, k) => a + PB_COST[w.pb[k]], 0);
}

function classPriority(cls) {
  const rec = CLASSES[cls].recommended;
  return AB_KEYS.slice().sort((a, b) => rec[b] - rec[a]);
}

function defaultAssign(w) {
  const order = classPriority(w.cls);
  const idx = w.pool.map((v, i) => i).sort((a, b) => w.pool[b] - w.pool[a]);
  const assign = {};
  order.forEach((ab, i) => { assign[ab] = idx[i]; });
  return assign;
}

function wizardBase(w) {
  if (w.method === "pointbuy") return { ...w.pb };
  const out = {};
  AB_KEYS.forEach((k) => { out[k] = w.pool[w.assign[k]]; });
  return out;
}

function rollAbilityPool() {
  const rolls = [];
  for (let i = 0; i < 6; i++) {
    const r = rollDice(4, 6).rolls.sort((a, b) => b - a);
    rolls.push({ dice: r, total: r[0] + r[1] + r[2] });
  }
  return rolls;
}

function setMethod(m) {
  wiz.method = m;
  if (m === "array") { wiz.pool = STANDARD_ARRAY.slice(); wiz.assign = defaultAssign(wiz); }
  if (m === "roll") { wiz.rolls = rollAbilityPool(); wiz.pool = wiz.rolls.map((r) => r.total); wiz.assign = defaultAssign(wiz); }
}

function stepValid(i, w = wiz) {
  switch (i) {
    case 0: return !!w.race;
    case 1: return !!w.cls && w.skills.length === CLASSES[w.cls].skillCount;
    case 2: return w.method !== "pointbuy" || pbLeft(w) === 0;
    case 3: return !!w.background;
    default: return true;
  }
}

function bonusText(bonus) {
  return Object.entries(bonus).map(([k, v]) => `${fmtMod(v)} ${ABILITIES[k].short}`).join(", ");
}

function cardsHtml(items, attr, selected) {
  return `<div class="cards">${items.map(([key, title, sub, body]) => `
    <button type="button" class="card" data-${attr}="${key}" aria-pressed="${selected === key}">
      <span class="card-title">${title}</span>
      ${sub ? `<span class="card-sub">${sub}</span>` : ""}
      ${body ? `<span class="card-body">${body}</span>` : ""}
    </button>`).join("")}</div>`;
}

function traitList(list) {
  return `<ul class="traits">${list.map(([n, d]) => `<li><strong>${n}.</strong> ${d}</li>`).join("")}</ul>`;
}

function wizRace() {
  const w = wiz;
  const r = w.race && RACES[w.race];
  return `
    <h2>Vyber si rasu</h2>
    <p class="muted">Rasa určuje, odkiaľ pochádzaš, a dáva ti bonusy k vlastnostiam a zvláštne schopnosti.</p>
    ${cardsHtml(Object.entries(RACES).map(([k, x]) => [k, x.name, bonusText(x.bonus), x.desc]), "race", w.race)}
    ${r ? `<div class="detail"><h3>${r.name}</h3><p class="small">Bonus k vlastnostiam: <strong>${bonusText(r.bonus)}</strong></p>${traitList(r.traits)}</div>` : ""}`;
}

function wizClass() {
  const w = wiz;
  const c = w.cls && CLASSES[w.cls];
  let detail = "";
  if (c) {
    const raceSkills = RACES[w.race].skills;
    const left = c.skillCount - w.skills.length;
    const spells = c.spells ? Object.entries(c.spells).map(([lvl, list]) =>
      `<li><strong>${lvl === "0" ? "Trik" : `${lvl}. úroveň`}:</strong> ${list.map((k) => SPELLS[k].name).join(", ")}</li>`).join("") : "";
    detail = `<div class="detail">
      <h3>${c.name}</h3>
      <p class="small">Kocka životov <strong>k${c.hitDie}</strong> · Hlavná vlastnosť <strong>${c.primary}</strong> · Záchranné hody <strong>${c.saves.map((a) => ABILITIES[a].name).join(", ")}</strong></p>
      <p class="small">Výzbroj: ${c.weapon.name} (${c.weapon.n}k${c.weapon.s} ${c.weapon.type}) · ${ARMOR[c.armor].name}</p>
      <h4>Schopnosti povolania</h4>
      <ul class="traits">${c.features.map(([lvl, n, d]) => `<li><span class="lvl">${lvl}. úr.</span> <strong>${n}.</strong> ${d}</li>`).join("")}</ul>
      ${spells ? `<h4>Kúzla</h4><ul class="traits">${spells}</ul>` : ""}
      <h4>Zručnosti <span class="points ${left === 0 ? "done" : ""}">${left === 0 ? "vybraté" : `vyber ešte ${left}`}</span></h4>
      <div class="skill-picks">
        ${c.skillChoices.map((sk) => {
          const fromRace = raceSkills.includes(sk);
          const checked = fromRace || w.skills.includes(sk);
          const disabled = fromRace || (!checked && left <= 0);
          return `<label class="pick ${disabled ? "off" : ""}"><input type="checkbox" data-skill="${sk}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}> ${SKILLS[sk].name} <span class="muted">(${ABILITIES[SKILLS[sk].ab].short})</span>${fromRace ? ' <span class="muted">– z rasy</span>' : ""}</label>`;
        }).join("")}
      </div>
    </div>`;
  }
  return `
    <h2>Vyber si povolanie</h2>
    <p class="muted">Povolanie určuje, ako bojuješ, koľko vydržíš a aké schopnosti a kúzla ovládaš.</p>
    ${cardsHtml(Object.entries(CLASSES).map(([k, x]) => [k, x.name, `k${x.hitDie} · ${x.primary}`, x.desc]), "cls", w.cls)}
    ${detail}`;
}

function wizAbilities() {
  const w = wiz;
  const race = RACES[w.race];
  const c = CLASSES[w.cls];
  const base = wizardBase(w);
  const left = pbLeft();
  const methods = [["pointbuy", "Nákup bodov"], ["array", "Štandardné hodnoty"], ["roll", "Hod kockami"]];
  const tabs = `<div class="opts" role="group">${methods.map(([k, n]) => `<button type="button" class="opt" data-method="${k}" aria-pressed="${w.method === k}">${n}</button>`).join("")}</div>`;
  let help = "";
  if (w.method === "pointbuy") help = `Každá vlastnosť začína na 8. Máš ${PB_TOTAL} bodov; vyššie hodnoty stoja viac (14 stojí 7 bodov, 15 stojí 9). <span class="points ${left === 0 ? "done" : ""}">Zostáva bodov: ${left}</span>`;
  if (w.method === "array") help = "Rozdeľ hodnoty 15, 14, 13, 12, 10 a 8. Keď vyberieš hodnotu, ktorú už má iná vlastnosť, vymenia sa.";
  if (w.method === "roll") help = `Pre každú hodnotu sa hodí 4k6 a najnižšia kocka sa zahodí. Hody: ${w.rolls.map((r) => `${r.total} <span class="muted">[${r.dice.slice(0, 3).join(", ")}, <s>${r.dice[3]}</s>]</span>`).join(" · ")}`;

  const rows = AB_KEYS.map((k) => {
    const rb = race.bonus[k] || 0;
    const total = base[k] + rb;
    let ctrl;
    if (w.method === "pointbuy") {
      ctrl = `<button type="button" class="step" data-pb="${k}" data-delta="-1" aria-label="Znížiť ${ABILITIES[k].name}" ${w.pb[k] <= 8 ? "disabled" : ""}>−</button>
        <span class="ab-base">${w.pb[k]}</span>
        <button type="button" class="step" data-pb="${k}" data-delta="1" aria-label="Zvýšiť ${ABILITIES[k].name}" ${w.pb[k] >= 15 || PB_COST[w.pb[k] + 1] - PB_COST[w.pb[k]] > left ? "disabled" : ""}>+</button>`;
    } else {
      ctrl = `<select data-assign="${k}" aria-label="Hodnota pre ${ABILITIES[k].name}">${w.pool.map((v, i) => `<option value="${i}" ${w.assign[k] === i ? "selected" : ""}>${v}</option>`).join("")}</select>`;
    }
    const isSave = c.saves.includes(k);
    return `<div class="ab-row">
      <div class="ab-name"><strong>${ABILITIES[k].name}</strong><span class="muted small">${ABILITIES[k].short}${isSave ? " · záchranný hod" : ""}</span></div>
      <div class="ab-ctrl">${ctrl}</div>
      <div class="ab-race ${rb ? "" : "muted"}">${rb ? fmtMod(rb) : "–"}</div>
      <div class="ab-total"><span>${total}</span><span class="ab-mod">${fmtMod(mod(total))}</span></div>
    </div>`;
  }).join("");

  const hp = c.hitDie + mod(base.con + (race.bonus.con || 0)) + (race.flags.includes("huzevnatost") ? 1 : 0);
  return `
    <h2>Vlastnosti</h2>
    <p class="muted">Šesť vlastností určuje, v čom je tvoja postava dobrá. Z hodnoty sa počíta modifikátor, ktorý pripočítavaš k hodom k20. Pre povolanie ${c.name.toLowerCase()} je najdôležitejšia ${c.primary.toLowerCase()}.</p>
    ${tabs}
    <p class="small">${help}</p>
    <div class="ab-table">
      <div class="ab-row ab-head"><div>Vlastnosť</div><div>Základ</div><div>Rasa</div><div>Spolu</div></div>
      ${rows}
    </div>
    <div class="opts">
      ${w.method === "pointbuy" ? `<button type="button" data-recommend="1">Odporúčané rozdelenie pre povolanie ${c.name}</button>` : ""}
      ${w.method === "roll" ? '<button type="button" data-reroll="1">Hodiť znova</button>' : ""}
    </div>
    <p class="small muted">Životy na 1. úrovni: <strong>${Math.max(1, hp)}</strong> (k${c.hitDie} na maximum + modifikátor Odolnosti).</p>`;
}

function wizBackground() {
  const w = wiz;
  const b = w.background && BACKGROUNDS[w.background];
  const have = new Set([...RACES[w.race].skills, ...w.skills]);
  return `
    <h2>Pôvod</h2>
    <p class="muted">Kým si bol pred dobrodružstvom? Pôvod pridá dve zručnosti, zlato a zvláštnu výhodu.</p>
    ${cardsHtml(Object.entries(BACKGROUNDS).map(([k, x]) => [k, x.name, x.skills.map((s) => SKILLS[s].name).join(", "), x.feature[0]]), "bg", w.background)}
    ${b ? `<div class="detail">
      <h3>${b.name}</h3>
      <p>${w.gender === "f" && b.descF ? b.descF : b.desc}</p>
      <p class="small">Zručnosti: ${b.skills.map((s) => `${SKILLS[s].name}${have.has(s) ? ' <span class="muted">(už ovládaš)</span>' : ""}`).join(", ")}</p>
      <p class="small">Zlato na začiatok: <strong>${15 + b.gold} zl</strong></p>
      ${traitList([b.feature])}
    </div>` : ""}`;
}

function wizIdentity() {
  const w = wiz;
  const f = w.gender === "f";
  return `
    <h2>Identita</h2>
    <div class="creation">
      <section>
        <label class="label" for="wiz-name">Meno postavy</label>
        <input id="wiz-name" class="text-input" maxlength="24" placeholder="${f ? "Pocestná" : "Pocestný"}" value="${escapeHtml(w.name)}" autocomplete="off">
      </section>
      <section>
        <div class="label">Pohlavie</div>
        <div class="opts" role="group">
          <button type="button" class="opt" data-gender="m" aria-pressed="${!f}">Muž</button>
          <button type="button" class="opt" data-gender="f" aria-pressed="${f}">Žena</button>
        </div>
        <p class="small muted">Podľa pohlavia sa prispôsobí text hry (${f ? "zasiahla si, si hrdinka" : "zasiahol si, si hrdina"}).</p>
      </section>
      <section>
        <div class="label">Presvedčenie</div>
        <div class="align-grid" role="group">
          ${Object.entries(ALIGNMENTS).map(([k, n]) => `<button type="button" class="opt" data-align="${k}" aria-pressed="${w.alignment === k}">${n}</button>`).join("")}
        </div>
        <p class="small muted">Presvedčenie opisuje morálku tvojej postavy. Na konci príbehu môže zohrať úlohu.</p>
      </section>
    </div>`;
}

function wizSummary() {
  const s = buildCharacter(wiz);
  return `<h2>Súhrn postavy</h2><p class="muted">Takto vyzerá tvoj denník postavy. Ak chceš niečo zmeniť, vráť sa na ktorýkoľvek krok.</p>${sheetHtml(s)}`;
}

function renderWizard() {
  const w = wiz;
  const steps = `<ol class="steps">${WIZ_STEPS.map((n, i) => `
    <li><button type="button" data-goto="${i}" ${i > w.maxStep ? "disabled" : ""} aria-current="${i === w.step ? "step" : "false"}"><span class="num">${i + 1}</span> ${n}</button></li>`).join("")}</ol>`;
  const body = [wizRace, wizClass, wizAbilities, wizBackground, wizIdentity, wizSummary][w.step]();
  $("story").innerHTML = steps + `<div class="wiz-body">${body}</div>`;

  const valid = stepValid(w.step);
  const last = w.step === WIZ_STEPS.length - 1;
  const reason = [
    "Najprv vyber rasu",
    w.cls ? `Vyber ešte ${CLASSES[w.cls].skillCount - w.skills.length} zručnosti` : "Najprv vyber povolanie",
    `Minúť ešte ${pbLeft()} bodov`,
    "Najprv vyber pôvod",
  ][w.step];
  renderChoices([
    last
      ? { label: "Začať dobrodružstvo", cls: "primary", action: finishWizard }
      : { label: valid ? `Ďalej: ${WIZ_STEPS[w.step + 1]}` : reason, cls: "primary", disabled: !valid, action: () => gotoStep(w.step + 1) },
    { label: w.step === 0 ? "Späť na moje postavy" : `Späť: ${WIZ_STEPS[w.step - 1]}`, action: () => (w.step === 0 ? openCharacterList() : gotoStep(w.step - 1)) },
  ]);
  renderStats();
  renderMenu();

  const story = $("story");
  story.onclick = wizardClick;
  story.onchange = wizardChange;
  story.oninput = (e) => { if (e.target.id === "wiz-name") wiz.name = e.target.value; };
}

function gotoStep(i) {
  if (i > wiz.step && !stepValid(wiz.step)) return;
  wiz.step = i;
  wiz.maxStep = Math.max(wiz.maxStep, i);
  renderWizard();
  $("app").scrollIntoView({ block: "start" });
}

// Po zmene niečoho v predchádzajúcom kroku sa neskoršie kroky musia znova potvrdiť.
function invalidateFrom(step) {
  for (let i = step; i < WIZ_STEPS.length; i++) {
    if (!stepValid(i)) { wiz.maxStep = Math.min(wiz.maxStep, i); break; }
  }
}

function wizardClick(e) {
  const t = e.target.closest("button");
  if (!t || t.disabled) return;
  const w = wiz;
  const d = t.dataset;
  const keepFocus = d.pb ? `[data-pb="${d.pb}"][data-delta="${d.delta}"]` : null;
  if (d.goto !== undefined) return gotoStep(Number(d.goto));
  if (d.race) {
    w.race = d.race;
    w.skills = w.skills.filter((s) => !RACES[w.race].skills.includes(s));
    invalidateFrom(1);
  } else if (d.cls) {
    if (w.cls !== d.cls) {
      w.cls = d.cls;
      w.skills = [];
      if (w.method !== "pointbuy") w.assign = defaultAssign(w);
    }
    invalidateFrom(1);
  } else if (d.method) {
    setMethod(d.method);
  } else if (d.pb) {
    const next = w.pb[d.pb] + Number(d.delta);
    if (next < 8 || next > 15) return;
    const cost = PB_COST[next] - PB_COST[w.pb[d.pb]];
    if (cost > pbLeft()) return;
    w.pb[d.pb] = next;
  } else if (d.recommend) {
    w.pb = { ...CLASSES[w.cls].recommended };
  } else if (d.reroll) {
    setMethod("roll");
  } else if (d.bg) {
    w.background = d.bg;
  } else if (d.gender) {
    w.gender = d.gender;
  } else if (d.align) {
    w.alignment = d.align;
  } else {
    return;
  }
  renderWizard();
  const sel = keepFocus || (d.race && `[data-race="${d.race}"]`) || (d.cls && `[data-cls="${d.cls}"]`) || (d.bg && `[data-bg="${d.bg}"]`)
    || (d.method && `[data-method="${d.method}"]`) || (d.gender && `[data-gender="${d.gender}"]`) || (d.align && `[data-align="${d.align}"]`);
  if (sel) {
    const again = $("story").querySelector(sel);
    if (again && !again.disabled) again.focus();
  }
}

function wizardChange(e) {
  const t = e.target;
  const w = wiz;
  if (t.dataset.skill) {
    const sk = t.dataset.skill;
    if (t.checked && !w.skills.includes(sk) && w.skills.length < CLASSES[w.cls].skillCount) w.skills.push(sk);
    if (!t.checked) w.skills = w.skills.filter((s) => s !== sk);
    renderWizard();
    const again = $("story").querySelector(`[data-skill="${sk}"]`);
    if (again) again.focus();
  } else if (t.dataset.assign) {
    const ab = t.dataset.assign;
    const idx = Number(t.value);
    const other = AB_KEYS.find((k) => k !== ab && w.assign[k] === idx);
    if (other) w.assign[other] = w.assign[ab];
    w.assign[ab] = idx;
    renderWizard();
    const again = $("story").querySelector(`[data-assign="${ab}"]`);
    if (again) again.focus();
  }
}

function finishWizard() {
  for (let i = 0; i < 4; i++) if (!stepValid(i)) return gotoStep(i);
  state = buildCharacter(wiz);
  wiz = null;
  screen = "game";
  log(`${state.name} sa vydáva na cestu: ${raceName().toLowerCase()}, ${className().toLowerCase()}, ${BACKGROUNDS[state.background].name.toLowerCase()}.`, "good");
  go("prichod");
}

// =========================================================
// Denník postavy
// =========================================================

function sheetHtml(s) {
  const race = RACES[s.race];
  const cls = CLASSES[s.cls];
  const bg = BACKGROUNDS[s.background];
  const slots = maxSlots(s);
  const spells = knownSpells(s);
  const features = cls.features.filter(([lvl]) => lvl <= s.level);
  const res = RES_KEYS.filter((k) => resMax(k, s) > 0);

  return `<div class="sheet">
    <div class="sheet-head">
      <div class="sheet-name">${escapeHtml(s.name)}</div>
      <div class="muted">${gs(s, race.name, race.nameF)} · ${gs(s, cls.name, cls.nameF)} ${s.level}. úrovne · ${bg.name} · ${ALIGNMENTS[s.alignment]}</div>
    </div>
    <div class="sheet-core">
      <div class="core"><span class="core-val">${armorClass(s)}</span><span class="core-label">Obranné číslo</span></div>
      <div class="core"><span class="core-val">${Math.max(0, s.hp)}/${s.maxHp}</span><span class="core-label">Životy</span></div>
      <div class="core"><span class="core-val">${fmtMod(abMod("dex", s))}</span><span class="core-label">Iniciatíva</span></div>
      <div class="core"><span class="core-val">${fmtMod(prof(s))}</span><span class="core-label">Zdatnosť</span></div>
      <div class="core"><span class="core-val">${s.hitDice}k${cls.hitDie}</span><span class="core-label">Kocky životov</span></div>
    </div>
    <div class="sheet-abilities">
      ${AB_KEYS.map((k) => `<div class="ability">
        <span class="ab-short">${ABILITIES[k].short}</span>
        <span class="ab-mod-big">${fmtMod(abMod(k, s))}</span>
        <span class="ab-score">${s.abil[k]}</span>
      </div>`).join("")}
    </div>
    <div class="sheet-cols">
      <section>
        <h4>Záchranné hody</h4>
        <ul class="plain">${AB_KEYS.map((k) => `<li class="${cls.saves.includes(k) ? "prof" : ""}"><span>${ABILITIES[k].name}</span><span>${fmtMod(saveBonus(k, s))}</span></li>`).join("")}</ul>
        <h4>Útok</h4>
        <ul class="plain">
          <li><span>${cls.weapon.name}</span><span>${fmtMod(weaponAttackBonus(s))}</span></li>
          <li class="muted small"><span>Poškodenie</span><span>${weaponDamageText(s)}</span></li>
          ${casterAb(s) ? `<li><span>Útok kúzlom</span><span>${fmtMod(spellAttackBonus(s))}</span></li><li><span>SO záchrany proti kúzlam</span><span>${spellDC(s)}</span></li>` : ""}
        </ul>
      </section>
      <section>
        <h4>Zručnosti</h4>
        <ul class="plain">${Object.entries(SKILLS).map(([k, sk]) => `<li class="${isProf(k, s) ? "prof" : ""}"><span>${sk.name} <span class="muted">(${ABILITIES[sk.ab].short})</span></span><span>${fmtMod(skillBonus(k, s))}</span></li>`).join("")}</ul>
        <p class="small muted">● zdatnosť: k hodu pridávaš zdatnostný bonus</p>
      </section>
    </div>
    <section>
      <h4>Schopnosti</h4>
      <ul class="traits">
        ${race.traits.map(([n, d]) => `<li><strong>${n}</strong> <span class="muted">(rasa)</span>. ${d}</li>`).join("")}
        ${features.map(([, n, d]) => `<li><strong>${n}</strong> <span class="muted">(povolanie)</span>. ${d}</li>`).join("")}
        <li><strong>${bg.feature[0]}</strong> <span class="muted">(pôvod)</span>. ${bg.feature[1]}</li>
      </ul>
      ${res.length ? `<p class="small">Použitia: ${res.map((k) => `${RES_NAMES[k]} ${s.res[k]}/${resMax(k, s)}`).join(" · ")}</p>` : ""}
    </section>
    ${spells.length ? `<section>
      <h4>Kúzla</h4>
      ${slots.length ? `<p class="small">Sloty kúziel: ${slots.map((m, i) => `${i + 1}. úroveň ${s.slots[i] || 0}/${m}`).join(" · ")}</p>` : ""}
      <ul class="traits">${spells.map((k) => `<li><strong>${SPELLS[k].name}</strong> <span class="muted">(${SPELLS[k].level ? `${SPELLS[k].level}. úroveň` : "trik, bez slotu"})</span>. ${SPELLS[k].desc}</li>`).join("")}</ul>
    </section>` : ""}
    <section>
      <h4>Výbava</h4>
      <p class="small">${cls.weapon.name}${s.weaponPlus ? ` +${s.weaponPlus}` : ""}, ${ARMOR[cls.armor].name}${s.armorPlus ? ` +${s.armorPlus}` : ""}${s.mageArmor ? ", Brnenie mága" : ""} · Elixír liečenia ${s.inv.elixir || 0}× · Väčší elixír ${s.inv.velky || 0}× · Svätená voda ${s.inv.voda || 0}× · <strong>${s.gold} zl</strong></p>
    </section>
  </div>`;
}

function showSheet() {
  show([sheetHtml(state)], [{ label: "Zavrieť denník", action: () => go(state.scene) }]);
}

// =========================================================
// Pohyb po svete
// =========================================================

function go(scene) {
  state.scene = scene;
  screen = "game";
  SCENES[scene]();
  queueSave();
}

// Po odmene skontroluje novú úroveň a až potom pokračuje.
function afterReward(next) {
  if (canLevelUp()) return levelUpScreen(next);
  next();
}

function prepChoices(back) {
  return { label: "Odpočinok a príprava", action: () => { state.flags.prepBack = back; go("priprava"); } };
}

function back(label = "Vrátiť sa do dediny") {
  return { label, action: () => go("dedina") };
}

const SCENES = {
  prichod() {
    show([
      `Cesta do Hôrky trvala tri dni. Keď konečne ${g("vyšiel", "vyšla")} z lesa, ${g("uvidel", "uvidela")} si dedinku zahalenú sivým oparom, hoci všade okolo svietilo slnko.`,
      `Pri bráne ťa čaká starosta Ondrej a premeria si ťa od hlavy po päty. „${raceName()}? A ${className().toLowerCase()}? Nuž, nikto iný neprišiel.“ Pokrčí plecami. „Poď, ukážem ti dedinu.“`,
    ], [{ label: "Vstúpiť do Hôrky", cls: "primary", action: () => go("dedina") }]);
  },

  dedina() {
    const f = state.flags;
    const text = [f.won
      ? "Nad Hôrkou svieti slnko. Deti sa hrajú pri studni a ľudia sa na teba usmievajú."
      : "Stojíš na námestí v Hôrke. Pár zhrbených dedinčanov ťa pozoruje s nádejou aj strachom. Nad strechami visí sivý opar."];
    show(text, [
      { label: "Navštíviť starostu Ondreja", action: () => go("starosta") },
      { label: "Obchod u Zuzky", action: () => go("obchod") },
      { label: "Hostinec U Zlatého klasu", action: () => go("hostinec") },
      prepChoices("dedina"),
      { label: "Vydať sa do Šepkavého lesa", action: () => go("les") },
      { label: f.caveKnown ? "Ísť k Zubatej jaskyni" : "Zubatá jaskyňa (zatiaľ ju nepoznáš)", disabled: !f.caveKnown, action: () => go("jaskyna") },
      { label: f.towerKnown ? "Ísť k Zrúcanej veži" : "Zrúcaná veža (zatiaľ ju nepoznáš)", disabled: !f.towerKnown, action: () => go("veza") },
    ]);
  },

  starosta() {
    const f = state.flags;
    const mult = state.background === "slachtic" ? 1.5 : 1;
    const choices = [];
    let text;
    if (f.won && !f.rewardPaid) {
      f.rewardPaid = true;
      const reward = Math.round((100 + (f.bonusReward ? 50 : 0)) * mult);
      state.gold += reward;
      note(`Starosta ti vypláca odmenu: ${reward} zl.`, "gold");
      text = [`Starosta Ondrej ťa objíme. „Si ${g("hrdina", "hrdinka")} Hôrky! Tu je tvoja odmena, ako som sľúbil.“`];
    } else if (f.won) {
      text = [`„Tvoje meno budú spievať ešte naši vnuci,“ usmieva sa starosta.`];
    } else if (f.chiefDead && !f.towerKnown) {
      f.towerKnown = true;
      const pay = Math.round(50 * mult);
      state.gold += pay;
      note(`Starosta ti dáva ${pay} zl ako zálohu. Nová lokalita: Zrúcaná veža.`, "gold");
      text = [
        "Ukážeš starostovi čierny amulet, ktorý mal Gruzz na krku. Starosta zbledne.",
        "„To je znak Morventa. Je to mág, ktorého sme pred rokmi vyhnali z dediny. Usadil sa v Zrúcanej veži za lesom a goblini sú len jeho sluhovia. Ak chceš kliatbu zlomiť, musíš ísť za ním.“",
      ];
    } else if (f.towerKnown) {
      text = [`„Morvent čaká vo veži,“ hovorí starosta. „Choď, až budeš ${g("pripravený", "pripravená")}.“`];
      if (!f.askedMorvent) {
        choices.push({ label: "Vypytovať sa na Morventa (História, SO 12)", action: () => {
          f.askedMorvent = true;
          if (skillCheck("historia", 12)) {
            f.knowRunes = true;
            show(["Spomenieš si na staré povesti o mágoch tieňa a doplníš ich o starostove spomienky. Morvent čerpá moc z ochranných rún vytesaných okolo svojej komnaty. Kto ich rozlúšti, oslabí ho."], [{ label: "Pokračovať", action: () => go("starosta") }]);
          } else {
            show(["Starosta rozpráva o Morventovej mladosti, ale nič užitočné sa nedozvieš."], [{ label: "Pokračovať", action: () => go("starosta") }]);
          }
        } });
      }
    } else if (f.caveKnown) {
      text = ["„Goblini zo Zubatej jaskyne kradnú naše ovce,“ vzdychá starosta. „Ich náčelník Gruzz má s tým tieňom niečo spoločné, som si istý.“"];
    } else if (f.quest) {
      text = ["„Stopy goblinov vedú hlboko do Šepkavého lesa,“ pripomína ti starosta. „Nájdi ich skrýšu.“"];
    } else {
      f.quest = true;
      text = [
        `Starosta Ondrej je starý muž s unavenými očami. „Vďaka, že si ${g("prišiel", "prišla")},“ povie.`,
        `„Všetko začalo, keď sa v lese objavili goblini. Drevorubači hovoria, že ich stopy vedú k nejakej jaskyni. Preskúmaj Šepkavý les a nájdi ju. Ak Hôrku zachrániš, dostaneš ${Math.round(100 * mult)} zlatých.“`,
      ];
    }
    if (f.quest && !f.won && !f.negotiated) {
      choices.push({ label: "Vyjednať vyššiu odmenu (Presviedčanie, SO 13)", action: () => {
        f.negotiated = true;
        if (skillCheck("presviedcanie", 13)) {
          f.bonusReward = true;
          show(["Starosta si povzdychne. „Dobre teda. Ak uspeješ, pridám ešte 50 zlatých.“"], [{ label: "Pokračovať", action: () => go("starosta") }]);
        } else {
          show(["„Viac nemáme,“ zamračí sa starosta. „Sme chudobná dedina.“"], [{ label: "Pokračovať", action: () => go("starosta") }]);
        }
      } });
    }
    choices.push({ label: "Späť na námestie", action: () => go("dedina") });
    show(text, choices);
  },

  obchod() {
    const disc = state.background === "kriminalnik" ? 0.8 : 1;
    const price = (p) => Math.round(p * disc);
    const text = [
      "Obchodníčka Zuzka si utiera ruky do zástery. „Čo to bude?“",
      `<span class="muted">Máš ${state.gold} zl.${disc < 1 ? " Vďaka známostiam máš zľavu 20 %." : ""}</span>`,
    ];
    const choices = Object.entries(ITEMS).map(([k, it]) => ({
      label: `${it.name} – ${price(it.price)} zl (${it.desc}) · máš ${state.inv[k] || 0}`,
      disabled: state.gold < price(it.price),
      action: () => {
        state.gold -= price(it.price);
        state.inv[k] = (state.inv[k] || 0) + 1;
        log(`${g("Kúpil", "Kúpila")} si: ${it.name}.`, "gold");
        go("obchod");
      },
    }));
    Object.entries(UPGRADES).forEach(([k, up]) => {
      const owned = k === "zbran" ? state.weaponPlus : state.armorPlus;
      choices.push({
        label: owned ? `${up.name} – hotové` : `${up.name} – ${price(up.price)} zl (${up.desc})`,
        disabled: !!owned || state.gold < price(up.price),
        action: () => {
          state.gold -= price(up.price);
          if (k === "zbran") state.weaponPlus = 1; else state.armorPlus = 1;
          log(`Kováč dokončil: ${up.name}.`, "gold");
          go("obchod");
        },
      });
    });
    choices.push({ label: "Späť na námestie", action: () => go("dedina") });
    show(text, choices);
  },

  hostinec() {
    const free = state.background === "ludovy_hrdina";
    const cost = free ? 0 : 5;
    const f = state.flags;
    show([
      "V hostinci U Zlatého klasu praská oheň v krbe. Hostinský Mišo leští korbele a pár sedliakov nad pivom polohlasne preberá posledné správy z lesa.",
    ], [
      {
        label: free ? "Dlhý odpočinok (zadarmo, si tu vítaný hosť)" : `Dlhý odpočinok – nocľah a večera (${cost} zl)`,
        disabled: state.gold < cost,
        action: () => {
          state.gold -= cost;
          longRest();
          show([`Vyspíš sa v teplej posteli. Ráno sa ${g("prebudíš oddýchnutý", "prebudíš oddýchnutá")}: obnovili sa ti všetky životy, kocky životov, sloty kúziel aj schopnosti.`],
            [{ label: "Pokračovať", action: () => go("hostinec") }]);
        },
      },
      {
        label: f.performed ? "Dnes si už pre hostí hral" + g("", "a") : "Zahrať a zaspievať hosťom (Vystupovanie, SO 12)",
        disabled: !!f.performed,
        action: () => {
          f.performed = true;
          if (skillCheck("vystupovanie", 12)) {
            const gold = rollDice(2, 6).total + 3;
            state.gold += gold;
            note(`Hostia ti do čiapky nahádžu ${gold} zl.`, "gold");
            show(["Sedliaci tlieskajú do rytmu a hostinský ti na účet domu donesie pivo."], [{ label: "Pokračovať", action: () => go("hostinec") }]);
          } else {
            show(["Po druhej slohe sa ozve pískanie. Radšej si sadneš."], [{ label: "Pokračovať", action: () => go("hostinec") }]);
          }
        },
      },
      ...(state.gold < cost ? [{
        label: "Prespať v stajni zadarmo (dlhý odpočinok)",
        action: () => {
          longRest();
          show([`Hostinský Mišo sa nad tebou zľutuje. „Na slame v stajni je miesta dosť.“ Ráno ťa zobudí kohút, ale ${g("si oddýchnutý", "si oddýchnutá")}.`],
            [{ label: "Pokračovať", action: () => go("hostinec") }]);
        },
      }] : []),
      { label: "Späť na námestie", action: () => go("dedina") },
    ]);
  },

  priprava() {
    const backTo = state.flags.prepBack || "dedina";
    const choices = [];
    const wild = backTo !== "dedina";
    choices.push({
      label: state.hitDice > 0 ? `Krátky odpočinok (1 hodina)${wild ? " – v divočine ťa môžu vyrušiť" : ""}` : "Krátky odpočinok (nemáš kocky životov, oddýchni si v hostinci)",
      disabled: state.hitDice <= 0 && SHORT_RES.every((k) => state.res[k] >= resMax(k)),
      action: () => shortRest(backTo, wild),
    });
    if (state.inv.elixir && state.hp < state.maxHp) choices.push({ label: `Vypiť elixír liečenia (${state.inv.elixir})`, action: () => { state.inv.elixir--; heal(rollDice(2, 4).total + 2, "Elixír liečenia"); go("priprava"); } });
    if (state.inv.velky && state.hp < state.maxHp) choices.push({ label: `Vypiť väčší elixír liečenia (${state.inv.velky})`, action: () => { state.inv.velky--; heal(rollDice(4, 4).total + 4, "Väčší elixír liečenia"); go("priprava"); } });
    const spells = knownSpells();
    if (spells.includes("liecenie_ran") && state.hp < state.maxHp) {
      const slot = findSlot(1);
      choices.push({ label: `Zoslať Liečenie rán${slot ? ` (slot ${slot}. úrovne)` : " – nemáš voľný slot"}`, disabled: !slot, action: () => { castHealing(slot); go("priprava"); } });
    }
    if (spells.includes("brnenie_maga") && !state.mageArmor) {
      const slot = findSlot(1);
      choices.push({ label: `Zoslať Brnenie mága${slot ? "" : " – nemáš voľný slot"}`, disabled: !slot, action: () => {
        state.slots[slot - 1]--;
        state.mageArmor = true;
        note(`Brnenie mága: tvoje obranné číslo je teraz ${armorClass()} až do dlhého odpočinku.`, "good");
        go("priprava");
      } });
    }
    choices.push({ label: "Späť", action: () => go(backTo) });
    show([`Zastavíš sa a ${g("pripravený", "pripravená")} premýšľaš, čo ďalej. Životy ${state.hp}/${state.maxHp}, kocky životov ${state.hitDice}/${state.level}.`], choices);
  },

  les() {
    const f = state.flags;
    const choices = [{ label: "Prehľadať les", action: exploreForest }];
    if (!f.caveKnown) {
      const ranger = state.cls === "hranicar";
      choices.push({ label: `Stopovať goblinov (Prežitie, SO 13${ranger ? ", výhoda vďaka obľúbenému nepriateľovi" : ""})`, action: () => {
        if (skillCheck("prezitie", 13, { adv: ranger })) {
          f.caveKnown = true;
          grantXp(50);
          note("Nová lokalita: Zubatá jaskyňa. +50 skúseností.", "good");
          show(["Nájdeš odtlačky goblinských nôh v blate a nasleduješ ich až k skalnatému svahu. Medzi balvanmi zíva temný otvor: Zubatá jaskyňa! Pri vchode visia kosti a kus plátna s namaľovaným okom."],
            [{ label: "Pokračovať", action: () => afterReward(() => go("les")) }]);
        } else {
          show(["Stopy sa strácajú v machu. Kým ich hľadáš, z krovia vyskočí niečo hladné!"],
            [{ label: "Brániť sa!", action: () => startCombat(forestFoe(), () => go("les"), { surprise: "enemy" }) }]);
        }
      } });
    }
    choices.push(prepChoices("les"));
    choices.push(back());
    show(["Šepkavý les je hustý a tmavý. Medzi stromami sa vlní hmla a niekde v diaľke praskne konár."], choices);
  },

  jaskyna() {
    const f = state.flags;
    const depth = f.caveDepth || 0;
    const choices = [];
    let text;
    if (f.chiefDead) {
      text = ["Jaskyňa je teraz tichá. Po goblinoch zostali len rozhádzané kosti a zhasnuté ohniská. V hlbinách však stále počuť trepot krídel."];
      choices.push({ label: "Preskúmať hlbiny jaskyne", action: () => startCombat(Math.random() < 0.5 ? "netopier" : "goblin", () => go("jaskyna")) });
    } else {
      text = [
        "Vstup do Zubatej jaskyne pripomína otvorenú tlamu. Zvnútra páchne dym a počuť chrapľavý smiech goblinov.",
        `<span class="muted">Postup jaskyňou: ${Math.min(depth, 2)}/2. ${depth >= 2 ? "Pred tebou je sála náčelníka." : ""}</span>`,
      ];
      if (depth < 2) {
        const torch = !hasTrait("tmave_videnie");
        choices.push({ label: `Zakradnúť sa hlbšie (Nenápadnosť, SO 12${torch ? ", nevýhoda: bez tmavého videnia nesieš fakľu" : ""})`, action: () => {
          if (skillCheck("nenapadnost", 12, { dis: torch })) {
            show(["Potichu sa prešmykneš okolo strážneho goblina, ktorý driemkajúc stráži chodbu. Je chrbtom k tebe."], [
              { label: "Prekvapiť ho útokom", action: () => startCombat("goblin", () => { f.caveDepth = depth + 1; go("jaskyna"); }, { surprise: "player" }) },
              { label: "Prekĺznuť ďalej bez boja", action: () => { f.caveDepth = depth + 1; grantXp(25); note("+25 skúseností za nenápadnosť.", "good"); afterReward(() => go("jaskyna")); } },
            ]);
          } else {
            show(["Pod nohou ti zarachotia kamienky. „Votrelec!“ zvrieskne goblin a vrhne sa na teba."],
              [{ label: "Brániť sa!", action: () => startCombat(Math.random() < 0.6 ? "goblin" : "netopier", () => { f.caveDepth = depth + 1; go("jaskyna"); }, { surprise: "enemy" }) }]);
          }
        } });
        choices.push({ label: "Postupovať otvorene a bojovať", action: () => startCombat(Math.random() < 0.6 ? "goblin" : "netopier", () => { f.caveDepth = depth + 1; go("jaskyna"); }) });
      } else {
        choices.push({ label: "Vstúpiť do sály náčelníka", cls: "primary", action: () => go("gruzz") });
      }
    }
    choices.push(prepChoices("jaskyna"));
    choices.push(back());
    show(text, choices);
  },

  gruzz() {
    const f = state.flags;
    const winGruzz = () => {
      f.chiefDead = true;
      note("Pri Gruzzovi nájdeš zvláštny čierny amulet. Možno o ňom niečo vie starosta.", "good");
      go("jaskyna");
    };
    const choices = [
      { label: "Zaútočiť!", cls: "primary", action: () => startCombat("gruzz", winGruzz) },
    ];
    if (!f.gruzzTalked) {
      choices.push({ label: "Zastrašiť ho (Zastrašovanie, SO 15)", action: () => {
        f.gruzzTalked = true;
        if (skillCheck("zastrasovanie", 15)) {
          show(["Gruzz o krok cúvne a v očiach sa mu mihne strach. Teraz je tvoja chvíľa!"], [{ label: "Zaútočiť!", action: () => startCombat("gruzz", winGruzz, { enemyFrightened: 2 }) }]);
        } else {
          show(["Gruzz sa zachechtá. „Malý červík robí veľký hluk!“ a rozbehne sa proti tebe."], [{ label: "Brániť sa!", action: () => startCombat("gruzz", winGruzz, { surprise: "enemy" }) }]);
        }
      } });
      choices.push({ label: "Presvedčiť ho, nech odíde (Presviedčanie, SO 17)", action: () => {
        f.gruzzTalked = true;
        if (skillCheck("presviedcanie", 17)) {
          f.chiefDead = true;
          grantXp(700);
          note("Gruzz odchádza. +700 skúseností.", "good");
          show(["„Morvent sľúbil zlato, ale dal len kliatby,“ zavrčí Gruzz. Strhne si z krku čierny amulet a hodí ti ho k nohám. „Vezmi si to. Gruzz ide preč.“ So svojimi goblinmi sa stratí v tme."],
            [{ label: "Pokračovať", action: () => afterReward(() => go("jaskyna")) }]);
        } else {
          show(["Gruzz ťa nepočúva. Zdvihne obrovský kyj a zareve."], [{ label: "Bojovať!", action: () => startCombat("gruzz", winGruzz) }]);
        }
      } });
    }
    choices.push({ label: "Ustúpiť z jaskyne", action: () => go("jaskyna") });
    show([
      "V sále plnej dymu sedí na tróne z kostí obrovský goblin s kyjom pobitým klincami. Na krku mu visí čierny amulet.",
      "„Gruzz ťa cíti už dlho,“ zavrčí náčelník. „Prišiel si zomrieť?“",
    ], choices);
  },

  veza() {
    const f = state.flags;
    if (f.won) {
      show(["Z veže zostali len studené kamene. Tieň zmizol navždy."], [back()]);
      return;
    }
    const floor = f.towerFloor || 0;
    const choices = [];
    if (floor === 0) {
      choices.push({ label: "Vystúpiť po schodoch na 1. poschodie", action: () => {
        if (f.trapDone) return startCombat("kostlivec", () => { f.towerFloor = 1; go("veza"); });
        f.trapDone = true;
        if (skillCheck("vnimanie", 13)) {
          show(["Všimneš si tenký drôt natiahnutý cez schod. Opatrne ho prekročíš. Hore zarachotia kosti."],
            [{ label: "Pokračovať", action: () => startCombat("kostlivec", () => { f.towerFloor = 1; go("veza"); }) }]);
        } else {
          const saved = playerSave("dex", 13);
          const dmg = rollDice(2, 6).total;
          hurtPlayer(saved ? Math.floor(dmg / 2) : dmg, "bodné", "Zo steny vystrelia šípky");
          if (state.hp <= 0) return knockedOut("Šípky boli otrávené. Svet sa ti zatmie pred očami.");
          show(["Pod nohou ti cvakne skrytý mechanizmus!", "Hore zarachotia kosti. Niekto počul hluk."],
            [{ label: "Pokračovať", action: () => startCombat("kostlivec", () => { f.towerFloor = 1; go("veza"); }) }]);
        }
      } });
    } else if (floor === 1) {
      choices.push({ label: "Vystúpiť na 2. poschodie", action: () => startCombat("prizrak", () => { f.towerFloor = 2; go("veza"); }) });
    } else {
      choices.push({ label: "Vstúpiť do Morventovej komnaty", cls: "primary", action: () => go("morvent") });
    }
    choices.push(prepChoices("veza"));
    choices.push(back());
    show([
      "Zrúcaná veža sa týči nad korunami stromov. Okolo nej víri čierny dym a vzduch je ťažký ako pred búrkou.",
      `<span class="muted">Postup vežou: ${floor}/2 poschodí.</span>`,
    ], choices);
  },

  morvent() {
    const f = state.flags;
    if (f.won) return go("veza");
    const evil = ["ZZ", "NZ", "CZ"].includes(state.alignment);
    const choices = [];
    if (!f.runesTried) {
      choices.push({ label: `Rozlúštiť ochranné runy (Arkána, SO 14${f.knowRunes ? ", výhoda vďaka starostovým povestiam" : ""})`, action: () => {
        f.runesTried = true;
        if (skillCheck("arkana", 14, { adv: f.knowRunes })) {
          f.runesBroken = true;
          show(["Prečítaš runy pozpätky a ich svetlo zhasne. Morvent zasyčí: jeho tieňový štít slabne a ohnivá mágia mu na chvíľu vypovie službu."], [{ label: "Pokračovať", action: () => go("morvent") }]);
        } else {
          const dmg = rollDice(2, 6).total;
          hurtPlayer(dmg, "nekrotické", "Runy vzplanú tieňom");
          if (state.hp <= 0) state.hp = 1;
          show(["Runy sa rozžiaria a tieň ťa šľahne ako bič."], [{ label: "Pokračovať", action: () => go("morvent") }]);
        }
      } });
    }
    choices.push({ label: "Bojovať!", cls: "primary", action: () => startCombat("morvent", victory) });
    if (!f.morventTalked) {
      choices.push({ label: "Presvedčiť ho, aby sa vzdal pomsty (Presviedčanie, SO 20)", action: () => {
        f.morventTalked = true;
        if (skillCheck("presviedcanie", 20)) {
          grantXp(1000);
          peaceEnding();
        } else {
          show(["„Slová!“ vyprskne Morvent. „Hôrka ma vyhnala slovami. Teraz bude hovoriť mágia.“"], [{ label: "Bojovať!", action: () => startCombat("morvent", victory) }]);
        }
      } });
    }
    if (evil) choices.push({ label: "Pridať sa k Morventovi", action: evilEnding });
    choices.push({ label: "Ustúpiť dolu schodmi", action: () => go("veza") });
    show([
      "Na vrchole veže stojí vysoká postava v plášti z tieňov. Oči jej žiaria fialovým svetlom. Na podlahe okolo nej žiaria vytesané runy.",
      `„${g("Ďalší hrdina", "Ďalšia hrdinka")},“ zasyčí Morvent. „Hôrka ma vyhnala. Teraz bude patriť mne. Navždy.“${evil ? " Prižmúri oči. „Alebo… cítim v tebe temnotu. Mohli by sme vládnuť spolu.“" : ""}`,
    ], choices);
  },

  koniec() {
    show(["Tvoje dobrodružstvo v Hôrke sa skončilo. Môžeš sa vrátiť do zoznamu postáv a začať nový príbeh."],
      [{ label: "Moje postavy", action: openCharacterList }]);
  },
};

function forestFoe() {
  const lvl = state.level;
  const table = lvl >= 4 ? ["vlk", "pavuk", "zbojnik"] : lvl >= 3 ? ["vlk", "goblin", "pavuk", "zbojnik"] : ["vlk", "goblin"];
  return table[rand(0, table.length - 1)];
}

function exploreForest() {
  const roll = Math.random();
  if (roll < 0.55) {
    const foe = forestFoe();
    if (skillCheck("vnimanie", 12)) {
      note("Zbadáš nepriateľa skôr, než on teba.", "good");
      return startCombat(foe, () => go("les"), { surprise: "player" });
    }
    return startCombat(foe, () => go("les"));
  }
  if (roll < 0.7) {
    const rogue = state.cls === "tulak";
    show(["Narazíš na opustený tábor zbojníkov. Pod plachtou stojí okovaná truhlica so zámkom."], [
      { label: `Otvoriť zámok (Obratnosť${rogue ? " so zlodejským náradím" : ""}, SO 13)`, action: () => {
        const r = rollD20(0, true);
        const bonus = abMod("dex") + (rogue ? prof() : 0);
        const ok = r.val + bonus >= 13;
        note(`Obratnosť: ${r.text} ${fmtMod(bonus)} = ${r.val + bonus} proti SO 13 → ${ok ? "úspech" : "neúspech"}`, ok ? "good" : "bad");
        lootChest(ok, "Zámok cvakne a veko sa otvorí.", "Zámok sa zasekne. Truhlica zostane zavretá.");
      } },
      { label: "Vypáčiť ju silou (Atletika, SO 15)", action: () => lootChest(skillCheck("atletika", 15), "Veko s praskotom povolí.", "Truhlica sa ani nepohne.") },
      { label: "Nechať ju tak", action: () => go("les") },
    ]);
    return;
  }
  if (roll < 0.85) {
    show(["Na čistinke rastie modrastá rastlina, ktorú bylinkári nazývajú vlčí koreň. Správne pripravená zastaví krvácanie."], [
      { label: "Pripraviť z nej obklad (Medicína, SO 11)", action: () => {
        if (skillCheck("medicina", 11)) heal(rollDice(2, 4).total + abMod("wis"), "Bylinný obklad");
        else note("Rastlinu pokazíš. Nič sa nestane.", "bad");
        show(["Pokračuješ ďalej lesom."], [{ label: "Pokračovať", action: () => go("les") }]);
      } },
      { label: "Pokračovať ďalej", action: () => go("les") },
    ]);
    return;
  }
  show(["Pri ceste leží zranený drevorubač. Noha mu krváca a lapá po dychu."], [
    { label: "Ošetriť ho (Medicína, SO 12)", action: () => {
      if (skillCheck("medicina", 12)) {
        state.gold += 15;
        grantXp(50);
        note("Drevorubač ti z vďaky dá 15 zl. +50 skúseností.", "gold");
        show(["Obviažeš mu nohu a pomôžeš mu na cestu. „Nech ťa Svetlo ochraňuje,“ povie."], [{ label: "Pokračovať", action: () => afterReward(() => go("les")) }]);
      } else {
        show(["Rana je horšia, než si myslel" + g("", "a") + ". Pomôžeš mu aspoň dostať sa k ceste, kde ho nájdu dedinčania."], [{ label: "Pokračovať", action: () => go("les") }]);
      }
    } },
    { label: "Nechať ho tak", action: () => go("les") },
  ]);
}

function lootChest(ok, okText, failText) {
  if (ok) {
    const gold = rollDice(2, 10).total + 5;
    state.gold += gold;
    note(`V truhlici je ${gold} zl.`, "gold");
    if (Math.random() < 0.35) { state.inv.elixir = (state.inv.elixir || 0) + 1; note("A k tomu elixír liečenia!", "good"); }
  }
  show([ok ? okText : failText], [{ label: "Pokračovať", action: () => go("les") }]);
}

// =========================================================
// Odpočinok a nová úroveň
// =========================================================

function longRest() {
  state.hp = state.maxHp;
  state.hitDice = state.level;
  state.slots = maxSlots();
  RES_KEYS.forEach((k) => { state.res[k] = resMax(k); });
  state.mageArmor = false;
  state.flags.performed = false;
  log("Dlhý odpočinok: všetko sa obnovilo.", "good");
}

function shortRest(backTo, wild) {
  if (wild && Math.random() < 0.25) {
    const foe = backTo === "jaskyna" ? "goblin" : backTo === "veza" ? "kostlivec" : forestFoe();
    note("Odpočinok preruší podozrivý zvuk!", "bad");
    return startCombat(foe, () => go(backTo), { surprise: "enemy" });
  }
  const finish = () => {
    SHORT_RES.forEach((k) => { state.res[k] = resMax(k); });
    if (state.res.arkanne > 0) {
      const maxLvl = Math.ceil(state.level / 2);
      const max = maxSlots();
      for (let i = Math.min(maxLvl, max.length); i >= 1; i--) {
        if (state.slots[i - 1] < max[i - 1]) {
          state.slots[i - 1]++;
          state.res.arkanne--;
          note(`Arkánne zotavenie: obnovil sa ti slot ${i}. úrovne.`, "good");
          break;
        }
      }
    }
    note("Krátky odpočinok: obnovili sa schopnosti, ktoré sa dobíjajú krátkym odpočinkom.", "good");
    go(backTo);
  };
  const render = () => {
    const hd = CLASSES[state.cls].hitDie;
    show([`Sadneš si, napiješ sa a ošetríš si rany. Môžeš minúť kocky životov: každá ti vráti k${hd} ${fmtMod(abMod("con"))} životov.`, `Životy ${state.hp}/${state.maxHp} · kocky životov ${state.hitDice}/${state.level}`], [
      { label: `Minúť kocku životov (k${hd} ${fmtMod(abMod("con"))})`, disabled: state.hitDice <= 0 || state.hp >= state.maxHp, action: () => {
        state.hitDice--;
        const r = die(hd);
        heal(Math.max(1, r + abMod("con")), `Kocka životov (k${hd}: ${r})`);
        render();
      } },
      { label: "Ukončiť odpočinok", cls: "primary", action: finish },
    ]);
  };
  render();
}

function levelUpScreen(next) {
  const oldSlots = maxSlots();
  const oldSpells = knownSpells();
  const oldRes = Object.fromEntries(RES_KEYS.map((k) => [k, resMax(k)]));
  state.level++;
  const hpGain = hpPerLevel();
  state.maxHp += hpGain;
  state.hp += hpGain;
  state.hitDice = Math.min(state.level, state.hitDice + 1);
  const newSlots = maxSlots();
  newSlots.forEach((m, i) => { state.slots[i] = (state.slots[i] || 0) + m - (oldSlots[i] || 0); });
  RES_KEYS.forEach((k) => { state.res[k] = (state.res[k] || 0) + Math.max(0, resMax(k) - oldRes[k]); });
  const feats = CLASSES[state.cls].features.filter(([lvl]) => lvl === state.level);
  const spells = knownSpells().filter((k) => !oldSpells.includes(k));
  const lines = [
    `<strong>Postupuješ na ${state.level}. úroveň!</strong>`,
    `Maximum životov +${hpGain} (teraz ${state.maxHp}).${state.level === 5 ? " Zdatnostný bonus stúpa na +3." : ""}`,
  ];
  if (newSlots.some((m, i) => m !== (oldSlots[i] || 0))) lines.push(`Sloty kúziel: ${newSlots.map((m, i) => `${i + 1}. úroveň ×${m}`).join(", ")}.`);
  feats.forEach(([, n, d]) => lines.push(`Nová schopnosť – <strong>${n}</strong>: ${d}`));
  spells.forEach((k) => lines.push(`Nové kúzlo – <strong>${SPELLS[k].name}</strong>: ${SPELLS[k].desc}`));
  log(`${g("Postúpil", "Postúpila")} si na ${state.level}. úroveň!`, "good");

  if (state.level === 4) {
    lines.push("Zvýšenie vlastnosti: vyber jednu vlastnosť, ktorá stúpne o 2 (najviac na 20).");
    show(lines, AB_KEYS.map((k) => ({
      label: `${ABILITIES[k].name}: ${state.abil[k]} → ${Math.min(20, state.abil[k] + 2)}`,
      disabled: state.abil[k] >= 20,
      action: () => {
        const oldCon = abMod("con");
        state.abil[k] = Math.min(20, state.abil[k] + 2);
        const conGain = (abMod("con") - oldCon) * state.level;
        if (conGain > 0) { state.maxHp += conGain; state.hp += conGain; }
        log(`${ABILITIES[k].name} stúpla na ${state.abil[k]}.`, "good");
        afterReward(next);
      },
    })));
    return;
  }
  show(lines, [{ label: "Pokračovať", cls: "primary", action: () => afterReward(next) }]);
}

// =========================================================
// Súboj
// =========================================================

function startCombat(key, onWin, opts = {}) {
  const t = ENEMIES[key];
  const e = { key, ...clone(t), maxHp: t.hp, cond: {} };
  combat = { e, onWin, round: 1, cond: {}, uncanny: false, sneakThisTurn: false, actionUsed: false, bonusUsed: false };
  if (key === "morvent") {
    e.fireball = !state.flags.runesBroken;
    if (state.flags.runesBroken) e.ac -= 2;
  }
  if (opts.enemyFrightened) e.cond.frightened = opts.enemyFrightened;
  log(`Súboj: ${e.name}`, "bad");
  screen = "game";

  let playerFirst;
  if (opts.surprise === "player") {
    playerFirst = true;
    combat.cond.adv = true;
    note(`Prekvapil${g("", "a")} si nepriateľa! Ideš prvý a prvý útok máš s výhodou.`, "good");
  } else if (opts.surprise === "enemy") {
    playerFirst = false;
    note(`${e.name} ťa prekvapil a útočí prvý!`, "bad");
  } else {
    const pr = rollD20(0, true);
    const er = die(20);
    const pt = pr.val + abMod("dex");
    const et = er + e.init;
    playerFirst = pt >= et;
    note(`Iniciatíva: ty ${pr.val} ${fmtMod(abMod("dex"))} = ${pt}, ${e.name} ${er} ${fmtMod(e.init)} = ${et}. ${playerFirst ? "Začínaš ty." : "Nepriateľ je rýchlejší."}`, "roll");
  }
  if (playerFirst) startPlayerTurn();
  else enemyTurn();
}

function startPlayerTurn() {
  const c = combat;
  c.actionUsed = false;
  c.bonusUsed = false;
  c.sneakThisTurn = false;
  c.cond.dodge = false;
  c.cond.reckless = false;
  if (c.cond.charmed) {
    c.cond.charmed = false;
    c.charmCooldown = 2;
    note("Morventov pohľad ťa drží v zajatí. Nedokážeš sa pohnúť a tvoj ťah prepadá.", "bad");
    return endPlayerTurn();
  }
  renderCombat();
}

function condTags() {
  const c = combat;
  const e = c.e;
  const mine = [];
  if (c.cond.rage) mine.push("Zúrivosť");
  if (c.cond.hidden) mine.push(g("Skrytý", "Skrytá"));
  if (c.cond.adv) mine.push("Výhoda na ďalší útok");
  if (c.cond.mark) mine.push("Lovcova značka");
  if (c.cond.spiritual) mine.push("Duchovná zbraň");
  if (c.cond.guardians) mine.push("Duchovní strážcovia");
  if (c.cond.frightened) mine.push(g("Vystrašený", "Vystrašená"));
  if (c.cond.prone) mine.push("Na zemi");
  const theirs = [];
  if (e.cond.turned) theirs.push("Odvrátený");
  if (e.cond.frightened) theirs.push("Vystrašený");
  if (e.cond.guided) theirs.push("Označený svetlom");
  return { mine, theirs };
}

function renderCombat() {
  const c = combat;
  const e = c.e;
  const tags = condTags();
  const panel = `<div class="enemy-panel">
    <div class="enemy-head"><strong>${e.name}</strong><span class="muted small">OČ ${e.ac}${tags.theirs.length ? ` · ${tags.theirs.join(", ")}` : ""}</span></div>
    ${bar(e.hp, e.maxHp, "hp")}
    <div class="muted small">Kolo ${c.round}${tags.mine.length ? ` · Ty: ${tags.mine.join(", ")}` : ""}</div>
  </div>`;
  const choices = [];
  const actions = c.actionUsed ? [] : actionOptions();
  const bonus = c.bonusUsed ? [] : bonusOptions();
  if (actions.length) choices.push({ heading: "Akcia" }, ...actions);
  if (bonus.length) choices.push({ heading: "Bonusová akcia" }, ...bonus);
  const surge = surgeOption();
  if (surge) choices.push({ heading: "Schopnosť" }, surge);
  choices.push({ label: c.actionUsed ? "Ukončiť ťah" : "Ukončiť ťah bez akcie", cls: "end-turn", action: endPlayerTurn });
  show([panel], choices);
}

function doAction(kind, fn) {
  const c = combat;
  if (kind === "action") c.actionUsed = true;
  else if (kind === "bonus") c.bonusUsed = true;
  fn();
  if (!combat) return;
  if (c.e.hp <= 0) return winCombat();
  const more = (!c.bonusUsed && bonusOptions().some((o) => !o.disabled)) || surgeOption();
  if (c.actionUsed && !more) return endPlayerTurn();
  renderCombat();
}

function actionOptions() {
  const c = combat;
  const e = c.e;
  const w = CLASSES[state.cls].weapon;
  const opts = [];
  const atkCount = extraAttack() ? 2 : 1;
  opts.push({ label: `Útok: ${w.name}${atkCount > 1 ? " (2 útoky)" : ""} – ${fmtMod(weaponAttackBonus())}, ${weaponDamageText()}`, action: () => doAction("action", () => attackAction(0)) });
  if (state.cls === "barbar" && state.level >= 2) {
    opts.push({ label: "Bezohľadný útok – útočíš s výhodou, nepriateľ tiež", action: () => doAction("action", () => { c.cond.reckless = true; attackAction(1); }) });
  }
  knownSpells().forEach((k) => {
    const sp = SPELLS[k];
    if (sp.outOfCombat || sp.bonus) return;
    if (k === "duchovni_strazcovia" && c.cond.guardians) return;
    if (sp.level === 0) {
      opts.push({ label: `Trik: ${sp.name}`, action: () => doAction("action", () => castSpell(k, 0)) });
    } else {
      const slot = findSlot(sp.level);
      opts.push({ label: `Kúzlo: ${sp.name} (${slot ? `slot ${slot}. úr.` : "žiadny voľný slot"})`, disabled: !slot || (sp.heal && state.hp >= state.maxHp), action: () => doAction("action", () => castSpell(k, slot)) });
    }
  });
  if (state.cls === "tulak" && state.level < 2 && !c.cond.hidden) {
    opts.push({ label: `Skryť sa (Nenápadnosť proti ${passivePerception(e)})`, action: () => doAction("action", hide) });
  }
  if (resMax("odvratenie") && e.tags.includes("nemŕtvy")) {
    opts.push({ label: `Odvrátenie nemŕtvych (${state.res.odvratenie}/1)`, disabled: !state.res.odvratenie || e.cond.turned, action: () => doAction("action", turnUndead) });
  }
  if (resMax("dych")) opts.push({ label: `Dračí dych (${state.res.dych}/1) – ${state.level >= 6 ? 3 : 2}k6 ohňom`, disabled: !state.res.dych, action: () => doAction("action", breath) });
  if (resMax("pokarhanie")) opts.push({ label: `Pekelné pokarhanie (${state.res.pokarhanie}/1) – 2k10 ohňom`, disabled: !state.res.pokarhanie, action: () => doAction("action", rebuke) });
  if (state.inv.voda && e.tags.includes("nemŕtvy")) opts.push({ label: `Hodiť svätenú vodu (${state.inv.voda}) – 2k6 žiarivého`, action: () => doAction("action", holyWater) });
  opts.push({ label: "Uhýbať – nepriateľ útočí s nevýhodou", action: () => doAction("action", () => { c.cond.dodge = true; note("Sústredíš sa na obranu a uhýbanie.", ""); }) });
  if (!e.boss) opts.push({ label: "Utiecť (Atletika alebo Akrobacia, SO 12)", action: () => doAction("action", flee) });
  return opts;
}

function bonusOptions() {
  const c = combat;
  const opts = [];
  if (resMax("druhyDych")) opts.push({ label: `Druhý dych (${state.res.druhyDych}/1) – vylieči 1k10+${state.level}`, disabled: !state.res.druhyDych || state.hp >= state.maxHp, action: () => doAction("bonus", () => {
    state.res.druhyDych--;
    heal(die(10) + state.level, "Druhý dych");
  }) });
  if (resMax("zurivost") && !c.cond.rage) opts.push({ label: `Zúrivosť (${state.res.zurivost}/${resMax("zurivost")})`, disabled: !state.res.zurivost, action: () => doAction("bonus", () => {
    state.res.zurivost--;
    c.cond.rage = true;
    note("Zareveš a krv sa ti rozbúri! +2 k poškodeniu, polovičné fyzické poškodenie.", "good");
  }) });
  if (state.cls === "tulak" && state.level >= 2 && !c.cond.hidden) opts.push({ label: `Skryť sa – prefíkaná akcia (Nenápadnosť proti ${passivePerception(c.e)})`, action: () => doAction("bonus", hide) });
  knownSpells().forEach((k) => {
    const sp = SPELLS[k];
    if (!sp.bonus) return;
    if (k === "lovcova_znacka" && c.cond.mark) return;
    if (k === "duchovna_zbran" && c.cond.spiritual) return;
    const slot = findSlot(sp.level);
    opts.push({ label: `Kúzlo: ${sp.name} (${slot ? `slot ${slot}. úr.` : "žiadny voľný slot"})`, disabled: !slot, action: () => doAction("bonus", () => castSpell(k, slot)) });
  });
  if (c.cond.spiritual) opts.push({ label: "Úder duchovnej zbrane", action: () => doAction("bonus", () => spellAttack(1, 8, "silové", "Duchovná zbraň", abMod("wis"))) });
  if (state.inv.elixir && state.hp < state.maxHp) opts.push({ label: `Vypiť elixír liečenia (${state.inv.elixir}) – 2k4+2`, action: () => doAction("bonus", () => { state.inv.elixir--; heal(rollDice(2, 4).total + 2, "Elixír liečenia"); }) });
  if (state.inv.velky && state.hp < state.maxHp) opts.push({ label: `Vypiť väčší elixír (${state.inv.velky}) – 4k4+4`, action: () => doAction("bonus", () => { state.inv.velky--; heal(rollDice(4, 4).total + 4, "Väčší elixír liečenia"); }) });
  return opts;
}

function surgeOption() {
  const c = combat;
  if (!c.actionUsed || !state.res.akcnyNaval || !resMax("akcnyNaval")) return null;
  return { label: "Akčný nával – získať ďalšiu akciu", action: () => {
    state.res.akcnyNaval--;
    c.actionUsed = false;
    note("Akčný nával! Máš ďalšiu akciu.", "good");
    renderCombat();
  } };
}

function passivePerception(e) { return 10 + (e.sv.wis || 0); }

function endPlayerTurn() {
  const c = combat;
  if (!c) return;
  if (c.cond.frightened) c.cond.frightened--;
  enemyTurn();
}

function enemyTurn() {
  const c = combat;
  const e = c.e;
  if (c.cond.guardians) {
    enemySaveDamage("wis", 3, 8, "žiarivé", "Duchovní strážcovia", true);
    if (e.hp <= 0) return winCombat();
  }
  if (e.cond.turned > 0) {
    e.cond.turned--;
    note(`${e.name} sa v hrôze krčí pred svätým symbolom a neútočí.`, "good");
  } else {
    enemyAct(e);
  }
  if (e.cond.frightened > 0) e.cond.frightened--;
  if (c.charmCooldown) c.charmCooldown--;
  if (state.hp <= 0 && !tryRelentless()) return startDying();
  c.round++;
  startPlayerTurn();
}

function enemyAct(e) {
  const c = combat;
  switch (e.special) {
    case "gruzz":
      if (Math.random() < 0.3) {
        if (enemyAttack(e, e.atk, e.dmg, e.dtype, "Gruzz sa rozbehne s kyjom nad hlavou")) {
          hurtPlayer(rollDice(1, 8).total, "drvivé", "Ohromný úder navyše");
        }
        return;
      }
      break;
    case "prizrak":
      if (c.round === 1 || (!c.cond.frightened && Math.random() < 0.25)) {
        note("Prízrak na teba upiera prázdne oči a z hrdla mu vyjde ľadový ston.", "bad");
        const adv = hasTrait("proti_strachu") || hasTrait("prefikanost");
        if (!playerSave("wis", 13, { adv })) {
          c.cond.frightened = 2;
          note(`Si ${g("vystrašený", "vystrašená")}: tvoje útoky majú nevýhodu.`, "bad");
        }
        return;
      }
      break;
    case "morvent":
      if (!e.fireball && die(6) >= 5) e.fireball = true;
      if (e.fireball && (c.round > 1 || !state.flags.runesBroken)) {
        e.fireball = false;
        note("Morvent zdvihne ruky a medzi dlaňami mu vyrastie ohnivá guľa!", "bad");
        const saved = playerSave("dex", 14);
        const dmg = rollDice(6, 6).total;
        hurtPlayer(saved ? Math.floor(dmg / 2) : dmg, "oheň", "Ohnivá guľa");
        return;
      }
      if (!c.charmCooldown && Math.random() < 0.3) {
        note("Morvent sa ti zahľadí do očí. Jeho hlas znie zrazu sladko a presvedčivo…", "bad");
        const adv = hasTrait("proti_ocareniu") || hasTrait("prefikanost");
        if (!playerSave("wis", 14, { adv })) {
          c.cond.charmed = true;
          note(`Si ${g("očarený", "očarená")}! Budúci ťah prepadá.`, "bad");
        } else {
          c.charmCooldown = 2;
        }
        return;
      }
      enemyAttack(e, e.atk, e.dmg, e.dtype, "Morvent vrhá tieňový blesk");
      return;
    default:
      break;
  }
  const hit = enemyAttack(e, e.atk, e.dmg, e.dtype);
  if (hit && e.onHit === "jed") {
    const saved = playerSave("con", 11, { adv: hasTrait("proti_jedu") });
    const dmg = rollDice(2, 8).total;
    hurtPlayer(saved ? Math.floor(dmg / 2) : dmg, "jed", "Pavúčí jed");
  }
  if (hit && e.onHit === "zrazenie" && state.hp > 0) {
    if (!playerSave("str", 11)) {
      c.cond.prone = true;
      note("Vlk ťa zrazil na zem. Jeho ďalší útok bude mať výhodu.", "bad");
    }
  }
}

function enemyAttack(e, bonus, dmg, type, label) {
  const c = combat;
  const adv = c.cond.prone || c.cond.reckless;
  const dis = c.cond.dodge || e.cond.frightened > 0 || c.cond.hidden;
  const r = rollD20(advMode(adv, dis));
  const total = r.val + bonus;
  const ac = armorClass();
  const crit = r.val === 20;
  const hit = crit || (r.val !== 1 && total >= ac);
  c.cond.prone = false;
  const who = label || `${e.name} útočí`;
  note(`${who}: ${r.text} ${fmtMod(bonus)} = ${total} proti tvojmu OČ ${ac} → ${hit ? (crit ? "KRITICKÝ ZÁSAH" : "zásah") : "vedľa"}`, "roll");
  if (!hit) return false;
  const amount = rollDice(dmg[0] * (crit ? 2 : 1), dmg[1]).total + dmg[2];
  hurtPlayer(amount, type, "Zranenie");
  return true;
}

function attackAction(extraAdv) {
  const n = extraAttack() ? 2 : 1;
  for (let i = 0; i < n && combat.e.hp > 0; i++) weaponAttack(extraAdv);
}

function weaponAttack(extraAdv = 0) {
  const c = combat;
  const e = c.e;
  const w = CLASSES[state.cls].weapon;
  const adv = extraAdv > 0 || c.cond.adv || c.cond.hidden || e.cond.guided;
  const dis = c.cond.frightened > 0;
  const mode = advMode(adv, dis);
  c.cond.adv = false;
  c.cond.hidden = false;
  e.cond.guided = false;
  const r = rollD20(mode, true);
  const bonus = weaponAttackBonus();
  const total = r.val + bonus;
  const crit = r.val === 20;
  const hit = crit || (r.val !== 1 && total >= e.ac);
  note(`${w.name}: ${r.text} ${fmtMod(bonus)} = ${total} proti OČ ${e.ac} → ${hit ? (crit ? "KRITICKÝ ZÁSAH" : "zásah") : "vedľa"}`, "roll");
  if (!hit) return;
  let dice = w.n * (crit ? 2 : 1);
  if (crit && hasTrait("divoke_utoky")) dice++;
  let dmg = rollDice(dice, w.s).total + abMod(w.ab) + (state.weaponPlus || 0);
  const extras = [];
  if (c.cond.rage) { dmg += 2; extras.push("zúrivosť +2"); }
  if (c.cond.mark) { const m = rollDice(crit ? 2 : 1, 6).total; dmg += m; extras.push(`značka +${m}`); }
  if (state.cls === "hranicar" && e.tags.includes("zviera")) { dmg += 2; extras.push("obľúbený nepriateľ +2"); }
  if (state.cls === "tulak" && mode > 0 && !c.sneakThisTurn) {
    const sn = rollDice(sneakDice() * (crit ? 2 : 1), 6).total;
    dmg += sn;
    c.sneakThisTurn = true;
    extras.push(`zákerný útok +${sn}`);
  }
  damageEnemy(Math.max(1, dmg), w.type, extras);
}

function damageEnemy(amount, type, extras = []) {
  const e = combat.e;
  let a = amount;
  if (e.vuln && e.vuln.includes(type)) { a *= 2; extras.push("zraniteľnosť ×2"); }
  e.hp -= a;
  if (e.cond.turned) { e.cond.turned = 0; note(`${e.name} sa po zásahu spamätá z hrôzy.`, ""); }
  note(`Poškodenie: ${a} (${type})${extras.length ? ` – ${extras.join(", ")}` : ""}. ${e.name}: ${Math.max(0, e.hp)}/${e.maxHp} životov.`, "good");
}

function spellAttack(n, sides, type, label, flat = 0) {
  const c = combat;
  const e = c.e;
  const adv = c.cond.adv || e.cond.guided;
  const dis = c.cond.frightened > 0;
  c.cond.adv = false;
  e.cond.guided = false;
  const r = rollD20(advMode(adv, dis), true);
  const bonus = spellAttackBonus();
  const total = r.val + bonus;
  const crit = r.val === 20;
  const hit = crit || (r.val !== 1 && total >= e.ac);
  note(`${label}: ${r.text} ${fmtMod(bonus)} = ${total} proti OČ ${e.ac} → ${hit ? (crit ? "KRITICKÝ ZÁSAH" : "zásah") : "vedľa"}`, "roll");
  if (hit) damageEnemy(rollDice(n * (crit ? 2 : 1), sides).total + flat, type);
  return hit;
}

function enemySaveDamage(ab, n, sides, type, label, half, dc = null) {
  const e = combat.e;
  const sdc = dc || spellDC();
  const r = die(20);
  const b = e.sv[ab] || 0;
  const ok = r + b >= sdc;
  note(`${label}: ${e.name} si hádže záchranu na ${ABILITIES[ab].name}: ${r} ${fmtMod(b)} = ${r + b} proti SO ${sdc} → ${ok ? "uspel" : "neuspel"}`, "roll");
  const dmg = rollDice(n, sides).total;
  const final = ok ? (half ? Math.floor(dmg / 2) : 0) : dmg;
  if (final > 0) damageEnemy(final, type);
  else note(`${e.name} sa kúzlu vyhol.`, "bad");
}

function findSlot(level) {
  for (let i = level; i <= (state.slots || []).length; i++) if (state.slots[i - 1] > 0) return i;
  return 0;
}

function castHealing(slot, consume = true) {
  if (consume) state.slots[slot - 1]--;
  const life = state.cls === "knaz" ? 2 + slot : 0;
  heal(rollDice(slot, 8).total + abMod(casterAb()) + life, `Liečenie rán${life ? " (Doména života)" : ""}`);
}

function castSpell(key, slot) {
  const c = combat;
  const sp = SPELLS[key];
  if (sp.level > 0) state.slots[slot - 1]--;
  const up = slot ? slot - sp.level : 0;
  switch (key) {
    case "ohnivy_sip": spellAttack(state.level >= 5 ? 2 : 1, 10, "oheň", sp.name); break;
    case "posvatny_plamen": enemySaveDamage("dex", state.level >= 5 ? 2 : 1, 8, "žiarivé", sp.name, false); break;
    case "magicka_strela": {
      const darts = 3 + up;
      let total = 0;
      for (let i = 0; i < darts; i++) total += die(4) + 1;
      note(`Magická strela: ${darts} šípky zasiahnu cieľ.`, "roll");
      damageEnemy(total, "silové");
      break;
    }
    case "spalujuci_luc": {
      const rays = 3 + up;
      for (let i = 0; i < rays && c.e.hp > 0; i++) spellAttack(2, 6, "oheň", `Spaľujúci lúč ${i + 1}`);
      break;
    }
    case "ohniva_gula": enemySaveDamage("dex", 8 + up, 6, "oheň", sp.name, true); break;
    case "liecenie_ran": castHealing(slot, false); break;
    case "navadzana_strela":
      if (spellAttack(4 + up, 6, "žiarivé", sp.name)) { c.e.cond.guided = true; note("Nepriateľ žiari. Ďalší útok proti nemu má výhodu.", "good"); }
      break;
    case "duchovna_zbran":
      c.cond.spiritual = true;
      note("Vo vzduchu sa zjaví žiariaci palcát.", "good");
      spellAttack(1 + Math.floor(up / 2), 8, "silové", sp.name, abMod("wis"));
      break;
    case "duchovni_strazcovia":
      c.cond.guardians = true;
      note("Okolo teba zakrúžia žiariaci duchovia.", "good");
      break;
    case "lovcova_znacka":
      c.cond.mark = true;
      note(`Označil${g("", "a")} si korisť. Každý zásah zbraňou pridá 1k6.`, "good");
      break;
    default: break;
  }
}

function hide() {
  const c = combat;
  if (skillCheck("nenapadnost", passivePerception(c.e))) {
    c.cond.hidden = true;
    note(`Si ${g("skrytý", "skrytá")}. Ďalší útok máš s výhodou.`, "good");
  } else {
    note("Nepriateľ ťa stále vidí.", "bad");
  }
}

function turnUndead() {
  const e = combat.e;
  state.res.odvratenie--;
  note("Zdvihneš svätý symbol a zaznie jasný tón Svetla.", "");
  const r = die(20);
  const b = e.sv.wis || 0;
  const ok = r + b >= spellDC();
  note(`${e.name}: záchrana na Múdrosť ${r} ${fmtMod(b)} = ${r + b} proti SO ${spellDC()} → ${ok ? "uspel" : "neuspel"}`, "roll");
  if (!ok) {
    e.cond.turned = 2;
    note(`${e.name} sa v hrôze odvráti. Dve kolá nebude útočiť (zásah ho preberie).`, "good");
  }
}

function breath() {
  state.res.dych--;
  note("Nadýchneš sa a vychrlíš prúd plameňov!", "");
  enemySaveDamage("dex", state.level >= 6 ? 3 : 2, 6, "oheň", "Dračí dych", true, 8 + abMod("con") + prof());
}

function rebuke() {
  state.res.pokarhanie--;
  note("Okolo nepriateľa vyšľahnú pekelné plamene!", "");
  enemySaveDamage("dex", 2, 10, "oheň", "Pekelné pokarhanie", true, 8 + abMod("cha") + prof());
}

function holyWater() {
  const e = combat.e;
  state.inv.voda--;
  const r = rollD20(0, true);
  const bonus = abMod("dex") + prof();
  const hit = r.val === 20 || (r.val !== 1 && r.val + bonus >= e.ac);
  note(`Svätená voda: ${r.text} ${fmtMod(bonus)} = ${r.val + bonus} proti OČ ${e.ac} → ${hit ? "zásah" : "vedľa"}`, "roll");
  if (hit) damageEnemy(rollDice(2, 6).total, "žiarivé");
}

function flee() {
  const sk = skillBonus("atletika") >= skillBonus("akrobacia") ? "atletika" : "akrobacia";
  if (skillCheck(sk, 12)) {
    note("Podarilo sa ti utiecť.", "good");
    combat = null;
    go(state.scene);
  } else {
    note("Nepriateľ ti zahradil cestu!", "bad");
  }
}

function winCombat() {
  const e = combat.e;
  const onWin = combat.onWin;
  combat = null;
  const gold = rand(e.gold[0], e.gold[1]);
  state.gold += gold;
  grantXp(e.xp);
  note(`${e.name} padol! +${e.xp} skúseností${gold ? `, +${gold} zl` : ""}.`, "gold");
  if (!e.final && Math.random() < 0.15) {
    state.inv.elixir = (state.inv.elixir || 0) + 1;
    note("Nepriateľ mal pri sebe elixír liečenia.", "good");
  }
  if (e.final) return onWin();
  show([`${e.name} leží na zemi. ${g("Zvíťazil", "Zvíťazila")} si!`], [{ label: "Pokračovať", cls: "primary", action: () => afterReward(onWin) }]);
}

// ---------- Hody proti smrti ----------

function startDying() {
  state.hp = 0;
  combat.dying = { s: 0, f: 0 };
  note("Padáš do bezvedomia! O tvojom osude rozhodnú hody proti smrti.", "bad");
  renderDying();
}

function pips(n, cls) {
  return [0, 1, 2].map((i) => `<span class="pip ${i < n ? cls : ""}"></span>`).join("");
}

function renderDying() {
  const d = combat.dying;
  show([
    "Ležíš na studenej zemi a svet sa vzďaľuje. Každý ťah si hodíš k20: 10 a viac je úspech, menej je neúspech. Padne 20? Preberieš sa. Padne 1? Rátajú sa dva neúspechy.",
    `<div class="death-saves"><div>Úspechy ${pips(d.s, "ok")}</div><div>Neúspechy ${pips(d.f, "fail")}</div></div>`,
  ], [{ label: "Hodiť hod proti smrti", cls: "primary", action: deathSave }]);
}

function deathSave() {
  const d = combat.dying;
  const r = rollD20(0, true);
  if (r.val === 20) {
    state.hp = 1;
    combat.dying = null;
    note(`Hod proti smrti: ${r.text}. Zázrak! Preberáš sa s 1 životom.`, "good");
    return startPlayerTurn();
  }
  if (r.val === 1) d.f += 2;
  else if (r.val >= 10) d.s++;
  else d.f++;
  note(`Hod proti smrti: ${r.text} → ${r.val >= 10 ? "úspech" : r.val === 1 ? "dva neúspechy" : "neúspech"}`, r.val >= 10 ? "good" : "bad");
  if (d.s >= 3) return stabilized();
  if (d.f >= 3) return died();
  renderDying();
}

function stabilized() {
  combat = null;
  knockedOut("Tvoj stav sa ustáli. Nepriateľ ťa nechá ležať a odíde.");
}

function knockedOut(text) {
  combat = null;
  const lost = Math.floor(state.gold / 2);
  state.gold -= lost;
  state.hp = 1;
  state.scene = "dedina";
  log("Dedinčania ťa priniesli späť do Hôrky.", "bad");
  show([text, `Večer ťa nájdu drevorubači a donesú ťa do Hôrky. Prebudíš sa s 1 životom. Pri páde si ${g("stratil", "stratila")} ${lost} zl.`],
    [{ label: "Pokračovať", action: () => go("dedina") }]);
}

function died() {
  combat = null;
  const half = state.background === "akolyta";
  const cost = half ? Math.floor(state.gold / 2) : state.gold;
  state.gold -= cost;
  state.hp = 1;
  state.flags.deaths = (state.flags.deaths || 0) + 1;
  state.scene = "dedina";
  log(`${state.name} ${g("zomrel", "zomrela")} a bol${g("", "a")} ${g("oživený", "oživená")} v chráme.`, "bad");
  show([
    `<strong>${g("Zomrel", "Zomrela")} si.</strong>`,
    `Dedinčania prinesú tvoje telo do chrámu Svetla. Kňažka Agáta sa celú noc modlí nad oltárom a za úsvitu sa ti do pľúc vráti dych. Obrad stál ${cost} zl${half ? " (chrám ti ako akolytovi dal zľavu)" : ""}.`,
  ], [{ label: "Pokračovať", action: () => go("dedina") }]);
}

// ---------- Konce príbehu ----------

function victory() {
  state.flags.won = true;
  state.scene = "dedina";
  log("Morvent je porazený! Kliatba nad Hôrkou je zlomená.", "good");
  show([
    "Morvent vykríkne a jeho telo sa rozpadne na čierny prach. Tieň nad krajinou sa trhá ako starý závoj a dnu prenikne slnko.",
    "Keď sa vrátiš do Hôrky, celá dedina ťa víta s kvetmi a spevom. Studne sú opäť čisté a polia zelené. Starosta ťa čaká s odmenou.",
    `<strong>Gratulujem, ${escapeHtml(state.name)}! ${g("Dohral", "Dohrala")} si hru na ${state.level}. úrovni.</strong>`,
  ], [{ label: "Vrátiť sa do Hôrky", cls: "primary", action: () => afterReward(() => go("dedina")) }]);
}

function peaceEnding() {
  state.flags.won = true;
  state.scene = "dedina";
  log("Morvent sa vzdal pomsty. Kliatba je zlomená.", "good");
  show([
    "Dlho rozprávaš o dedine, o deťoch pri studni a o tom, že pomsta nikoho neuzdraví. Morventovi sa roztrasie hlas.",
    "Napokon zloží ruky. Runy na podlahe zhasnú a tieň nad krajinou sa rozplynie. „Odídem,“ povie potichu. „A už sa nevrátim.“",
    `<strong>${g("Zachránil", "Zachránila")} si Hôrku bez jediného úderu. Gratulujem, ${escapeHtml(state.name)}!</strong>`,
  ], [{ label: "Vrátiť sa do Hôrky", cls: "primary", action: () => afterReward(() => go("dedina")) }]);
}

function evilEnding() {
  state.flags.evilEnd = true;
  log(`${state.name} sa ${g("pridal", "pridala")} k Morventovi.`, "bad");
  state.scene = "koniec";
  queueSave();
  show([
    "Podáš Morventovi ruku. Jeho prsty sú studené ako ľad. Tieň sa rozlieva ďalej, cez les, cez polia, až k bráne Hôrky.",
    "O rok neskôr už nikto nespomína dedinu menom. Hovorí sa jej Tieňová Hôrka a vládnu jej dvaja mágovia z veže.",
    "<strong>Koniec. Temný koniec.</strong>",
  ], [{ label: "Moje postavy", action: openCharacterList }]);
}

// =========================================================
// Štart
// =========================================================

showLogin();
detectCloudAccount().then((acc) => {
  cloudAccount = acc;
  cloudChecked = true;
  if (screen === "login") showLogin();
});
