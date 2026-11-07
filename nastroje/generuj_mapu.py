"""
Z nakreslenej mapy (mapa/zdroj/mapa.jpg) vygeneruje podklady pre Unreal Engine 5:

  mapa/unreal/heightmap.png        16-bit čiernobiely heightmap (2017 x 1135)
  mapa/unreal/vrstvy/*.png         8-bit masky vrstiev terénu (rovnaká veľkosť)
  mapa/nahlad/*.png                náhľady na kontrolu

Spustenie:  python3 nastroje/generuj_mapu.py
Potrebuje:  pip install numpy pillow scipy
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "mapa/zdroj/mapa.jpg"
OUT = ROOT / "mapa/unreal"
LAYERS_DIR = OUT / "vrstvy"
PREVIEW = ROOT / "mapa/nahlad"

# Platná veľkosť landscape pre Unreal: 63 quadov na komponent,
# 32 x 18 komponentov -> 2017 x 1135 vertexov (pomer strán ako originál).
W, H = 2017, 1135

# Výšky v rozsahu 0..1 (v Unreale 0.5 = nula, pri Z scale 100 je rozsah 512 m).
SEA_FLOOR = 0.40
SEA_LEVEL = 0.48   # sem dáš hladinu vody
COAST = 0.495
LAND = 0.52

# ---------------------------------------------------------------------------
# HORY – ručne odčítané z kresby (súradnice v pixeloch originálu 2000 x 1125).
# Každý hrebeň: (body lomenej čiary, polomer v px, výška 0..1).
# Záporná výška = kaňon / roklina. Uprav podľa seba a spusti skript znova.
# ---------------------------------------------------------------------------
RIDGES = [
    # zasnežený masív na severozápade
    ([(520, 100), (640, 140), (760, 120), (900, 150)], 60, 1.00),
    ([(560, 220), (680, 260), (770, 225)], 50, 0.85),
    ([(510, 160), (560, 230)], 35, 0.70),
    # vrch pri jazere
    ([(770, 280), (790, 340)], 22, 0.35),
    # temný štít v magickom lese
    ([(740, 455)], 25, 0.45),
    # severovýchodný hrebeň cez pláne
    ([(1100, 260), (1250, 300), (1400, 380)], 32, 0.55),
    ([(1240, 160), (1270, 190)], 28, 0.30),
    ([(1430, 250), (1490, 290)], 28, 0.30),
    # skaly uprostred púšte
    ([(990, 430), (1060, 450)], 28, 0.20),
    # skalná ihla v lese na východe planiny
    ([(1300, 430)], 16, 0.25),
    # južné pohorie pod púšťou
    ([(880, 640), (1000, 620), (1100, 590), (1190, 590)], 48, 0.60),
    # východné pobrežné hory
    ([(1580, 400), (1660, 500)], 25, 0.40),
    ([(1520, 545), (1580, 565)], 35, 0.40),
    # sopka v jazere na východe
    ([(1400, 640)], 15, 0.25),
    # juhovýchodné hory
    ([(1280, 740), (1340, 770)], 35, 0.35),
    ([(1350, 870)], 25, 0.25),
    # sopka v južnom lese
    ([(870, 850)], 30, 0.40),
    ([(965, 740)], 12, 0.12),
    # západné hory
    ([(410, 570), (460, 590)], 30, 0.35),
    ([(510, 640), (560, 650)], 30, 0.35),
    ([(300, 820), (350, 830), (430, 850)], 25, 0.30),
    ([(335, 960)], 20, 0.25),
    ([(460, 500)], 20, 0.20),
    ([(335, 500), (345, 540)], 15, 0.20),
    # južný ostrov
    ([(1030, 930), (1200, 915), (1380, 975)], 30, 0.45),
    ([(1100, 1040), (1250, 1025)], 25, 0.35),
    # kaňon (čierne útesy) – roklina
    ([(1350, 540), (1300, 580), (1250, 630), (1170, 700)], 16, -0.06),
]


def blur(a, s):
    return ndi.gaussian_filter(a, s, mode="nearest")


def norm(a):
    a = a - a.min()
    m = a.max()
    return a / m if m > 0 else a


def fbm_noise(shape, seed=1, octaves=6, base=4):
    """Fraktálny šum (súčet rozmazaných náhodných polí) pre prírodný vzhľad."""
    rng = np.random.default_rng(seed)
    out = np.zeros(shape)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        cells = (max(2, shape[0] * base * 2**o // shape[1]), base * 2**o)
        small = rng.random(cells)
        big = np.asarray(
            Image.fromarray((small * 255).astype(np.uint8)).resize(
                (shape[1], shape[0]), Image.BICUBIC
            ),
            dtype=float,
        ) / 255.0
        out += big * amp
        total += amp
        amp *= 0.5
    return out / total


def ridge_field(shape, sx, sy, seed=5):
    """Výškové pole z RIDGES.

    Pozdĺž každého hrebeňa sa rozmiestnia jednotlivé štíty s náhodnou výškou
    a šírkou, spojené nižším sedlom – vyzerá to ako skutočné pohorie.
    """
    rng = np.random.default_rng(seed)
    H_, W_ = shape
    pos = np.zeros(shape)
    neg = np.zeros(shape)

    def bump(cx, cy, rad, height, target, use_max=True):
        x0, x1 = int(max(0, cx - 3 * rad)), int(min(W_, cx + 3 * rad + 1))
        y0, y1 = int(max(0, cy - 3 * rad)), int(min(H_, cy + 3 * rad + 1))
        if x0 >= x1 or y0 >= y1:
            return
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(float)
        f = np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / rad**2) * 2.0) * height
        win = target[y0:y1, x0:x1]
        target[y0:y1, x0:x1] = np.maximum(win, f) if use_max else np.minimum(win, f)

    for pts, radius, height in RIDGES:
        pts = [(x * sx, y * sy) for x, y in pts]
        rad = radius * sx
        if len(pts) == 1:
            pts = pts * 2
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            seg = np.hypot(bx - ax, by - ay)
            # sedlo (spojitý hrebeň) – husto, nízko
            n = max(1, int(seg / (rad * 0.25)))
            for t in np.linspace(0, 1, n + 1):
                cx, cy = ax + (bx - ax) * t, ay + (by - ay) * t
                if height >= 0:
                    bump(cx, cy, rad * 0.8, height * 0.55, pos)
                else:
                    bump(cx, cy, rad, height, neg, use_max=False)
            if height < 0:
                continue
            # jednotlivé štíty
            n = max(1, int(seg / (rad * 0.6)))
            for t in np.linspace(0, 1, n + 1):
                cx = ax + (bx - ax) * t + rng.normal(0, rad * 0.3)
                cy = ay + (by - ay) * t + rng.normal(0, rad * 0.3)
                bump(cx, cy, rad * rng.uniform(0.45, 0.8), height * rng.uniform(0.7, 1.0), pos)
    return pos, neg


def main():
    img = Image.open(SRC).convert("RGB").resize((W, H), Image.LANCZOS)
    rgb = np.asarray(img).astype(float) / 255.0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    # Regionálne priemery farby (kresba je plná detailov, chceme "oblasti").
    rs, gs, bs = (blur(c, 6) for c in (r, g, b))
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    lum_s = blur(lum, 6)
    mx = np.maximum(np.maximum(rs, gs), bs)
    mn = np.minimum(np.minimum(rs, gs), bs)
    sat = (mx - mn) / (mx + 1e-6)

    # --- Voda: tyrkysová (G a B výrazne nad R) ---
    water = ((gs - rs) > 0.17) & ((bs - rs) > 0.14)
    water = ndi.binary_opening(water, iterations=2)
    water = ndi.binary_closing(water, iterations=2)
    water[:6, :] = water[-6:, :] = True     # okraj mapy je vždy more
    water[:, :6] = water[:, -6:] = True
    # odstráň drobné ostrovčeky šumu a drobné "jazierka"
    lab, n = ndi.label(~water)
    sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
    land = np.isin(lab, np.where(sizes > 400)[0] + 1)
    lab, n = ndi.label(~land)
    sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
    land = ~np.isin(lab, np.where(sizes > 60)[0] + 1)
    water = ~land

    # oceán = voda spojená s okrajom mapy; zvyšok sú vnútrozemské jazerá
    lab, n = ndi.label(water)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    ocean = np.isin(lab, list(border))
    lakes = water & ~ocean

    peaks, canyon = ridge_field((H, W), W / 2000.0, H / 1125.0)
    # "domain warp": rozkriví okrúhle kopce, aby vyzerali prírodne
    wx = (fbm_noise((H, W), seed=21, base=12, octaves=4) - 0.5) * 60
    wy = (fbm_noise((H, W), seed=22, base=12, octaves=4) - 0.5) * 60
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    peaks = ndi.map_coordinates(peaks, [yy + wy, xx + wx], order=1, mode="nearest")

    # --- Typy povrchu ---
    greenness = gs - (rs + bs) / 2
    desert = ((rs > gs * 0.98) & (rs - bs > 0.12) & (lum_s > 0.47)).astype(float)
    dry = ((rs > gs * 0.95) & (rs - bs > 0.06) & (lum_s > 0.36) & (lum_s <= 0.47)).astype(float)
    forest = ((greenness > 0.06) & (lum_s < 0.30)).astype(float)
    grass = ((greenness > 0.06) & (lum_s >= 0.30)).astype(float)

    # --- Heightmap ---
    dist_land = ndi.distance_transform_edt(land)
    dist_sea = ndi.distance_transform_edt(~land)
    inland = np.clip(dist_land / 120.0, 0, 1) ** 0.8  # pobrežie stúpa do vnútrozemia

    noise = fbm_noise((H, W), seed=7)
    detail = fbm_noise((H, W), seed=11, base=16, octaves=4)

    h = np.full((H, W), LAND)
    h += inland * 0.035                         # mierne vyvýšené vnútrozemie
    h += (noise - 0.5) * 0.04 * inland          # zvlnené pahorky
    h += blur(forest, 8) * 0.008
    h -= blur(desert, 20) * 0.01                # púšť je plochá kotlina
    ridged = 1 - np.abs(2 * fbm_noise((H, W), seed=3, base=10, octaves=5) - 1)
    fine = 1 - np.abs(2 * fbm_noise((H, W), seed=4, base=40, octaves=3) - 1)
    h += peaks * 0.42 * (0.6 + 0.3 * ridged + 0.1 * fine)  # pohoria so štítmi
    h += canyon                                  # roklina

    # pobrežie: plynulý prechod pod hladinu
    beach_t = np.clip(dist_land / 10.0, 0, 1)
    h = np.where(land, COAST + (h - COAST) * beach_t, h)
    sea = SEA_LEVEL - 0.02 - np.clip(dist_sea / 60.0, 0, 1) * (SEA_LEVEL - SEA_FLOOR)
    h = np.where(ocean, sea + (noise - 0.5) * 0.01, h)
    lake_depth = np.clip(ndi.distance_transform_edt(lakes) / 8.0, 0, 1)
    h = np.where(lakes, LAND + 0.01 - lake_depth * 0.03, h)

    h = blur(h, 1.5)
    h = np.clip(h, 0, 1)

    # --- Vrstvy (váhy sa v každom bode sčítajú na 1) ---
    beach = (land & (dist_land < 6)).astype(float)
    gy, gx = np.gradient(h * 512.0)            # sklon v "metroch" na pixel
    slope = np.hypot(gx, gy)
    mountain = np.clip((peaks - 0.25) * 3, 0, 1) * land
    rock = np.clip(np.maximum(mountain * 0.8, (slope - 1.2) * 1.2), 0, 1)
    rock = np.maximum(rock, np.clip(-canyon * 20, 0, 1))
    snow = np.clip((h - 0.80) * 12, 0, 1) * land
    layers = {
        "trava": blur(grass, 2),
        "les": blur(forest, 2),
        "piesok": np.maximum(blur(desert, 2), beach),
        "hlina": blur(dry, 2),
        "skala": blur(rock, 1.5),
        "sneh": blur(snow, 1.5),
        "dno": (~land).astype(float),
    }
    # sneh a skala prebíjajú zvyšok
    for k in ("trava", "les", "piesok", "hlina"):
        layers[k] *= 1 - np.clip(layers["skala"] + layers["sneh"], 0, 1)
    layers["skala"] *= 1 - layers["sneh"]
    stack = np.stack(list(layers.values()))
    stack[0] += (stack.sum(0) < 0.05) * (~ocean)  # nezaradené = tráva
    stack /= stack.sum(0, keepdims=True) + 1e-6

    OUT.mkdir(parents=True, exist_ok=True)
    LAYERS_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)

    Image.fromarray((h * 65535).astype(np.uint16)).save(OUT / "heightmap.png")
    for (name, _), arr in zip(layers.items(), stack):
        Image.fromarray((arr * 255).astype(np.uint8)).save(LAYERS_DIR / f"{name}.png")
    Image.fromarray((lakes * 255).astype(np.uint8)).save(LAYERS_DIR / "jazera_maska.png")

    # --- Náhľady ---
    gy, gx = np.gradient(h * 250)
    shade = np.clip(0.55 + (-gx * 0.7 - gy * 0.7) / np.sqrt(1 + gx**2 + gy**2) * 0.9, 0, 1)
    colors = np.array([
        [0.36, 0.55, 0.22],  # trava
        [0.18, 0.36, 0.14],  # les
        [0.86, 0.79, 0.55],  # piesok
        [0.60, 0.50, 0.36],  # hlina
        [0.50, 0.48, 0.46],  # skala
        [0.95, 0.96, 0.98],  # sneh
        [0.15, 0.45, 0.50],  # dno
    ])
    col = np.tensordot(stack.transpose(1, 2, 0), colors, axes=1)
    under = h < SEA_LEVEL
    col[under] = col[under] * 0.4 + np.array([0.1, 0.45, 0.55]) * 0.6
    col[lakes] = [0.25, 0.55, 0.70]
    rend = np.clip(col * (0.45 + 0.75 * shade[..., None]), 0, 1)
    Image.fromarray((rend * 255).astype(np.uint8)).save(PREVIEW / "nahlad_3d.png")
    Image.fromarray((h * 255).astype(np.uint8)).save(PREVIEW / "heightmap_8bit.png")

    print(f"hotovo: {W}x{H}, výška min {h.min():.3f} max {h.max():.3f}")


if __name__ == "__main__":
    main()
