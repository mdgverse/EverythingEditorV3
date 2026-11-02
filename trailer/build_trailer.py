#!/usr/bin/env python3
"""Trailer do Everything Editor 3.0.2 — 9:16, 30 s, 30 fps, sem áudio.

    pip install pillow numpy imageio-ffmpeg
    python build_trailer.py                    # gera everything-editor-trailer.mp4
    python build_trailer.py --still 5 13.8     # só quadros soltos (PNG)

Cenas: abertura · Spin Focus (nascar) · Color Ramp HVNTER 69 + Invert (rx7) ·
HalfMode Studio (escada) · Glitch RGB (cosplay) · grafo de nós · cartela final.
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import imageio_ffmpeg

AQUI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(AQUI, 'src')
W, H, FPS = 1080, 1920, 30
DUR = 30.0
N = int(DUR * FPS)

BG = (10, 11, 13)
ACCENT = (255, 138, 61)
ACCENT2 = (255, 198, 96)
TEXT = (246, 247, 249)
MUTED = (158, 167, 180)

F_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
F_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
_fonts = {}


def font(path, size):
    if (path, size) not in _fonts:
        _fonts[(path, size)] = ImageFont.truetype(path, size)
    return _fonts[(path, size)]


def hex_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], np.float32) / 255.0


def luma(img):
    return img[..., 0] * 0.2126 + img[..., 1] * 0.7152 + img[..., 2] * 0.0722


def carrega(nome, cx=0.5, cy=0.5):
    im = Image.open(os.path.join(SRC, nome)).convert('RGB')
    alvo = W / H
    r = im.width / im.height
    if r > alvo:
        nw = int(im.height * alvo)
        x0 = int(np.clip(cx * im.width - nw / 2, 0, im.width - nw))
        im = im.crop((x0, 0, x0 + nw, im.height))
    else:
        nh = int(im.width / alvo)
        y0 = int(np.clip(cy * im.height - nh / 2, 0, im.height - nh))
        im = im.crop((0, y0, im.width, y0 + nh))
    return np.asarray(im.resize((W, H), Image.LANCZOS), np.float32) / 255.0


# ------------------------------------------------------------------ efeitos
def bilin(img, x, y):
    h, w = img.shape[:2]
    px = np.clip(x * (w - 1), 0, w - 1)
    py = np.clip((1.0 - y) * (h - 1), 0, h - 1)
    x0 = np.floor(px).astype(np.int32); y0 = np.floor(py).astype(np.int32)
    x1 = np.minimum(x0 + 1, w - 1); y1 = np.minimum(y0 + 1, h - 1)
    fx = (px - x0)[..., None]; fy = (py - y0)[..., None]
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x1] * fx * (1 - fy)
            + img[y1, x0] * (1 - fx) * fy + img[y1, x1] * fx * fy)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / max(e1 - e0, 1e-6), 0, 1)
    return t * t * (3 - 2 * t)


def spin_focus(img, cx=0.50, cy=0.46, core=0.34, core_soft=0.60, strength=0.78,
               samples=44, leak=0.55, warmth=0.80, vig=0.35, haze=0.28, chroma=0.08):
    """Nó 'Spin Focus Light Leak' — mesmo algoritmo do editor."""
    h, w = img.shape[:2]
    ux = np.linspace(0, 1, w, dtype=np.float32)[None, :].repeat(h, 0)
    uy = np.linspace(1, 0, h, dtype=np.float32)[:, None].repeat(w, 1)
    uv = np.stack([ux, uy], -1)
    c = np.array([cx, 1 - cy], np.float32)
    d = uv - c
    r = np.sqrt((d[..., 0] * (w / h)) ** 2 + d[..., 1] ** 2)
    ramp = smoothstep(core * 0.85, core * 0.85 + max(0.02, core_soft * 0.45), r)
    sweep = strength * 55 * math.pi / 180
    acc = np.zeros_like(img)
    for i in range(samples):
        t = i / (samples - 1) if samples > 1 else 0.5
        ang = sweep * (t - 0.5) * ramp
        cs, sn = np.cos(ang), np.sin(ang)
        dx = cs * d[..., 0] + sn * d[..., 1]
        dy = -sn * d[..., 0] + cs * d[..., 1]
        acc += bilin(img, c[0] + dx, c[1] + dy)
    base = acc / samples
    if chroma > 0:
        ca = chroma * 0.005 * ramp
        n = np.sqrt(d[..., 0] ** 2 + d[..., 1] ** 2) + 1e-5
        m = 0.7 * ramp
        base[..., 0] = (1 - m) * base[..., 0] + m * bilin(img, uv[..., 0] + d[..., 0] / n * ca,
                                                          uv[..., 1] + d[..., 1] / n * ca)[..., 0]
        base[..., 2] = (1 - m) * base[..., 2] + m * bilin(img, uv[..., 0] - d[..., 0] / n * ca,
                                                          uv[..., 1] - d[..., 1] / n * ca)[..., 2]
    if haze > 0:
        hz = 0.0035 * (1 + r * 5)
        g = 0.25 * (bilin(img, uv[..., 0] + hz, uv[..., 1]) + bilin(img, uv[..., 0] - hz, uv[..., 1])
                    + bilin(img, uv[..., 0], uv[..., 1] + hz) + bilin(img, uv[..., 0], uv[..., 1] - hz))
        base = (1 - haze * 0.6) * base + haze * 0.6 * (base * 0.55 + g * 0.80)
    lk = np.zeros_like(img)
    for (lx, ly), col, k, mult in [((0.16, 0.88), (1.00, 0.34, 0.60), 14.0, 0.50),
                                   ((0.88, 0.90), (1.00, 0.78, 0.36), 20.0, 1.00),
                                   ((0.03, 0.06), (1.00, 0.46, 0.14), 16.0, 0.85),
                                   ((0.98, 0.04), (1.00, 0.52, 0.16), 18.0, 0.90)]:
        d2 = (uv[..., 0] - lx) ** 2 + (uv[..., 1] - ly) ** 2
        wgt = np.exp(-d2 * k) * mult
        lk += np.stack([wgt * cc for cc in col], -1)
    lk += np.stack([(1.0 - smoothstep(0.0, 0.52, uv[..., 1])) * 0.26 * cc
                    for cc in (1.00, 0.54, 0.20)], -1)
    edge = smoothstep(0.12, 0.95, r)[..., None]
    lk = lk * leak * (0.22 + 0.78 * edge)
    lk *= (np.array([1.00, 0.96, 0.88]) * (1 - warmth) + np.array([1.10, 0.70, 0.52]) * warmth)
    out = 1 - (1 - base) * (1 - np.clip(lk, 0, 1))
    out *= 1 - vig * smoothstep(0.35, 1.05, r)[..., None] * (0.55 + 0.45 * ramp)[..., None]
    return np.clip(out, 0, 1)


# Color Ramp: preset HVNTER 69 do editor, com o botão Invert (a rampa vira)
HVNTER_69 = [(0.0, '#cfd8e0'), (0.156, '#ccd7e1'), (0.5, '#1589ce'), (0.594, '#324456'),
             (0.656, '#99b3e3'), (0.688, '#99b3e3'), (0.812, '#252729'), (1.0, '#1f1f1f')]


def ramp_lut(stops, invert=False, n=512):
    pos = np.array([p for p, _ in stops], np.float32)
    cols = np.stack([hex_rgb(h) for _, h in stops])
    if invert:
        pos = 1.0 - pos[::-1]
        cols = cols[::-1]
    t = np.linspace(0, 1, n, dtype=np.float32)
    return np.stack([np.interp(t, pos, cols[:, k]) for k in range(3)], -1).astype(np.float32)


def color_ramp(img, stops=HVNTER_69, invert=True):
    f = np.clip(luma(img), 0, 1)
    lut = ramp_lut(stops, invert)
    idx = np.clip((f * (len(lut) - 1)).astype(np.int32), 0, len(lut) - 1)
    return np.clip(lut[idx], 0, 1)


def _dots(fonte, cell, angle):
    h, w = fonte.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    a = math.radians(angle)
    xr = xx * math.cos(a) + yy * math.sin(a)
    yr = -xx * math.sin(a) + yy * math.cos(a)
    cx = (xr % cell) - cell * 0.5
    cy = (yr % cell) - cell * 0.5
    dist = np.sqrt(cx ** 2 + cy ** 2)
    ci = np.clip((yr // cell).astype(np.int32), 0, h - 1)
    cj = np.clip((xr // cell).astype(np.int32), 0, w - 1)
    ch, cw = int(yr.max() // cell) + 2, int(xr.max() // cell) + 2
    acc = np.zeros((ch, cw), np.float32)
    cnt = np.zeros((ch, cw), np.float32)
    np.add.at(acc, (ci, cj), fonte)
    np.add.at(cnt, (ci, cj), 1.0)
    media = acc / np.maximum(cnt, 1)
    raio = np.clip(media[ci, cj], 0, 1) * (cell * 0.66)
    return dist <= raio


def halfmode(img, cell=9, ink1='#00AEEF', a1=15.0, ink2='#EC008C', a2=75.0, paper='#ffffff'):
    """HalfMode Studio: tinta 1 sombras, tinta 2 médios, multiply sobre o papel."""
    lum = luma(img)
    out = np.ones_like(img) * hex_rgb(paper)
    m1 = _dots(np.clip(1.0 - lum, 0, 1) ** 0.9, cell, a1)
    m2 = _dots(np.clip(lum * 0.85 + 0.15, 0, 1) ** 0.9, cell, a2)
    for m, cor in ((m1, ink1), (m2, ink2)):
        c = hex_rgb(cor)
        out[m] = out[m] * (0.92 * c + 0.08)
    return np.clip(out, 0, 1)


def glitch(img, t):
    out = img.copy()
    rng = np.random.default_rng(int(t * 1000) % 100000)
    h = img.shape[0]
    for _ in range(7):
        y0 = int(rng.integers(0, h - 40))
        hh = int(rng.integers(8, 60))
        dx = int(rng.integers(-70, 70))
        out[y0:y0 + hh] = np.roll(img[y0:y0 + hh], dx, axis=1)
    shift = int(8 + 10 * abs(math.sin(t * 3.1)))
    out[..., 0] = np.roll(out[..., 0], shift, axis=1)
    out[..., 2] = np.roll(out[..., 2], -shift, axis=1)
    yy = np.arange(h)[:, None]
    scan = 0.86 + 0.14 * ((yy // 3) % 2)
    out *= np.repeat(scan[..., None], img.shape[1], axis=1)
    return np.clip(out, 0, 1)


# ---------------------------------------------------------------- utilidades
def kb(img, p, z0=1.02, z1=1.12, cx=0.5, cy=0.5):
    z = z0 + (z1 - z0) * p
    cw, ch = int(W / z), int(H / z)
    x = int(np.clip(cx * W - cw / 2, 0, W - cw))
    y = int(np.clip(cy * H - ch / 2, 0, H - ch))
    return img.crop((x, y, x + cw, y + ch)).resize((W, H), Image.BILINEAR)


def arr_img(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def ease(p):
    p = max(0.0, min(1.0, p))
    return p * p * (3 - 2 * p)


def texto(d, xy, s, f, fill, anchor='la', alpha=1.0):
    if alpha <= 0.01:
        return
    if alpha < 0.99:
        camada = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(camada).text(xy, s, font=f, fill=fill + (int(255 * alpha),), anchor=anchor)
        d._image.paste(camada, (0, 0), camada)
    else:
        d.text(xy, s, font=f, fill=fill, anchor=anchor)


SCRIM = None


def _scrim():
    global SCRIM
    if SCRIM is None:
        col = np.zeros((H, W, 4), np.uint8)
        y0 = H - 880
        for y in range(y0, H):
            k = (y - y0) / (H - y0)
            col[y, :, 3] = int(242 * (k ** 0.75))
        SCRIM = Image.fromarray(col, 'RGBA')
    return SCRIM


def legenda(d, p, kicker, titulo, sub):
    d._image.paste(_scrim(), (0, 0), _scrim())
    a = ease(min(p / 0.12, 1.0)) * ease(min((1 - p) / 0.12, 1.0))
    dy = int((1 - ease(min(p / 0.2, 1.0))) * 26)
    y0 = H - 470 + dy
    d.rectangle([70, y0 + 96, 70 + int(120 * ease(min(p / 0.25, 1.0))), y0 + 102], fill=ACCENT)
    texto(d, (70, y0), kicker, font(F_BOLD, 30), ACCENT2, alpha=a)
    texto(d, (70, y0 + 40), titulo, font(F_BOLD, 64), TEXT, alpha=a)
    texto(d, (70, y0 + 122), sub, font(F_REG, 31), MUTED, alpha=a)


# --------------------------------------------------------------------- cenas
def cena_intro(c, p):
    img = c._image
    ImageDraw.Draw(img).rectangle([0, 0, W, H], fill=BG)
    gl = Image.new('RGB', (W, H), BG)
    gd = ImageDraw.Draw(gl)
    for i in range(28, 0, -1):
        r = int(120 + i * 26)
        k = i / 28
        gd.ellipse([W // 2 - r, int(H * 0.42) - r, W // 2 + r, int(H * 0.42) + r],
                   fill=(int(BG[0] + 40 * (1 - k)), int(BG[1] + 22 * (1 - k)), int(BG[2] + 8 * (1 - k))))
    img.paste(gl.filter(ImageFilter.GaussianBlur(26)), (0, 0))
    d = ImageDraw.Draw(img)
    s = 210
    a = ease(min(p / 0.35, 1.0))
    ss = int(s * (0.85 + 0.15 * a))
    xx, yy = W // 2 - ss // 2, int(H * 0.40) - ss // 2
    d.rounded_rectangle([xx, yy, xx + ss, yy + ss], radius=int(ss * 0.22), fill=(0, 0, 0),
                        outline=(255, 255, 255), width=2)
    for k in range(2):
        off = int((k - 0.5) * ss * 0.34)
        d.arc([xx + 30 + off, yy + int(ss * 0.18), xx + ss - 30 + off, yy + int(ss * 0.82)],
              start=-72, end=72, fill=(255, 255, 255), width=max(3, int(ss * 0.05)))
    texto(d, (W // 2, int(H * 0.40) + s // 2 + 70), 'Everything Editor', font(F_BOLD, 84),
          TEXT, anchor='ma', alpha=a)
    texto(d, (W // 2, int(H * 0.40) + s // 2 + 160), 'by mdgverse.dsgn', font(F_REG, 34),
          MUTED, anchor='ma', alpha=a)
    texto(d, (W // 2, H - 240), 'v3.0.2', font(F_BOLD, 32), ACCENT, anchor='ma',
          alpha=ease(min((p - 0.35) / 0.3, 1.0)))


def cena_efeito(c, p, chave, cx, cy, kicker, titulo, sub, ef):
    c._image.paste(kb(BASE[chave], p, 1.02, 1.12, cx, cy), (0, 0))
    k = ease(min(max((p - 0.10) / 0.30, 0.0), 1.0))
    if k > 0.01 and ef is not None:
        cam = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        cam.paste(kb(ef(p), p, 1.02, 1.12, cx, cy), (0, 0))
        cam.putalpha(int(255 * k))
        c._image.paste(cam, (0, 0), cam)
    legenda(ImageDraw.Draw(c._image), p, kicker, titulo, sub)


def cena_grafo(c, p):
    d = ImageDraw.Draw(c._image)
    d.rectangle([0, 0, W, H], fill=(14, 16, 19))
    for gy in range(0, H, 60):
        for gx in range(0, W, 60):
            d.point((gx, gy), fill=(28, 31, 36))
    nos = [(80, 270, 430, 178, 'Image / GIF', (56, 122, 96), 0.00),
           (520, 540, 460, 210, 'Spin Focus / Light Leak', (214, 122, 42), 0.14),
           (100, 830, 430, 190, 'Color Ramp', (86, 96, 178), 0.30),
           (490, 1090, 470, 200, 'HalfMode Studio', (150, 82, 140), 0.46)]
    caixas = []
    for (x, y, w, h, rot, cor, t0) in nos:
        a = ease(min(max((p - t0) / 0.22, 0), 1))
        if a <= 0.01:
            caixas.append(None)
            continue
        oy = int((1 - a) * 60)
        box = (x, y + oy, x + w, y + h + oy)
        d.rounded_rectangle(box, radius=18, fill=(26, 28, 33), outline=(58, 62, 70), width=2)
        d.rounded_rectangle([box[0], box[1], box[2], box[1] + 56], radius=18, fill=cor)
        d.rectangle([box[0], box[1] + 34, box[2], box[1] + 56], fill=cor)
        tam = 30 if len(rot) < 16 else 24
        texto(d, (box[0] + 18, box[1] + 27), rot, font(F_BOLD, tam), (255, 255, 255), anchor='lm', alpha=a)
        for i in range(2):
            by = box[1] + 82 + i * 52
            d.rounded_rectangle([box[0] + 18, by, box[2] - 18, by + 34], radius=8,
                                fill=(48, 52, 60), outline=(72, 78, 90), width=1)
        d.ellipse([box[0] - 10, box[1] + h // 2 - 10, box[0] + 10, box[1] + h // 2 + 10], fill=ACCENT2)
        d.ellipse([box[2] - 10, box[1] + h // 2 - 10, box[2] + 10, box[1] + h // 2 + 10], fill=ACCENT)
        caixas.append(box)
    for i in range(len(caixas) - 1):
        b0, b1 = caixas[i], caixas[i + 1]
        if not b0 or not b1:
            continue
        x0, y0 = b0[2] - 10, (b0[1] + b0[3]) // 2
        x1, y1 = b1[0] + 10, (b1[1] + b1[3]) // 2
        g = ease(min(max((p - 0.20 - i * 0.12) / 0.26, 0), 1))
        if g <= 0.01:
            continue
        pts = []
        for k in range(29):
            tt = k / 28 * g
            mx = x0 + (x1 - x0) * 0.55
            pts.append(((1 - tt) ** 3 * x0 + 3 * (1 - tt) ** 2 * tt * mx
                        + 3 * (1 - tt) * tt ** 2 * mx + tt ** 3 * x1,
                        (1 - tt) ** 3 * y0 + 3 * (1 - tt) ** 2 * tt * y0
                        + 3 * (1 - tt) * tt ** 2 * y1 + tt ** 3 * y1))
        d.line(pts, fill=(198, 176, 60), width=7, joint='curve')
    legenda(d, p, 'GRAFO DE NÓS', 'Monte o fluxo', 'nós, curvas e preview em tempo real')


def cena_final(c, p):
    d = ImageDraw.Draw(c._image)
    d.rectangle([0, 0, W, H], fill=BG)
    gl = Image.new('RGB', (W, H), BG)
    gd = ImageDraw.Draw(gl)
    for i in range(24, 0, -1):
        r = int(140 + i * 30)
        k = i / 24
        gd.ellipse([W // 2 - r, int(H * 0.34) - r, W // 2 + r, int(H * 0.34) + r],
                   fill=(int(BG[0] + 60 * (1 - k)), int(BG[1] + 33 * (1 - k)), int(BG[2] + 14 * (1 - k))))
    c._image.paste(gl.filter(ImageFilter.GaussianBlur(34)), (0, 0))
    d = ImageDraw.Draw(c._image)
    a = ease(min(p / 0.25, 1))
    texto(d, (W // 2, int(H * 0.30)), 'Everything Editor', font(F_BOLD, 88), TEXT, anchor='ma', alpha=a)
    texto(d, (W // 2, int(H * 0.30) + 126), 'v3.0.2', font(F_BOLD, 44), ACCENT, anchor='ma', alpha=a)
    texto(d, (W // 2, int(H * 0.30) + 240), 'grátis · offline · web e Android', font(F_REG, 37),
          TEXT, anchor='ma', alpha=a)
    texto(d, (W // 2, int(H * 0.30) + 308), 'efeitos em tempo real, sem instalar nada', font(F_REG, 31),
          MUTED, anchor='ma', alpha=a)
    a2 = ease(min(max((p - 0.35) / 0.3, 0), 1))
    d.rounded_rectangle([W // 2 - 390, int(H * 0.62), W // 2 + 390, int(H * 0.62) + 104],
                        radius=52, fill=(255, 138, 61))
    texto(d, (W // 2, int(H * 0.62) + 52), 'mdgverse.github.io/EverythingEditorV3',
          font(F_BOLD, 29), (18, 12, 8), anchor='mm', alpha=a2)


# ------------------------------------------------------------------ montagem
BASE = {}
BASE_NP = {}
GRAIN = None


class Cena:
    def __init__(self, img):
        self._image = img


def pos_processa(img, t):
    global GRAIN
    a = np.asarray(img, np.float32) / 255.0
    if GRAIN is None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        rx = (xx - W / 2) / (W / 2)
        ry = (yy - H / 2) / (H / 2)
        GRAIN = np.clip(1.0 - 0.30 * (rx ** 2 + ry ** 2) * 0.5, 0.55, 1.0)[..., None]
    ruido = np.random.default_rng(int(t * 997) % 99991).normal(0, 0.009, a.shape[:2])[..., None]
    a = np.clip((a + ruido) * GRAIN + 0.004, 0, 1)
    im = arr_img(a)
    d = ImageDraw.Draw(im)
    d.rectangle([0, H - 8, int(W * min(1.0, t / DUR)), H], fill=ACCENT)
    return im


def main():
    print('carregando fotos e aplicando os efeitos…', flush=True)
    nascar = carrega('nascar.jpg', cx=0.60, cy=0.52)
    rx7 = carrega('rx7.jpg', cx=0.46, cy=0.50)
    escada = carrega('escada.jpg', cx=0.50, cy=0.46)
    cosplay = carrega('cosplay.jpg', cx=0.50, cy=0.42)
    for k, v in (('nascar', nascar), ('rx7', rx7), ('escada', escada), ('cosplay', cosplay)):
        BASE_NP[k] = v
        BASE[k] = arr_img(v)

    ef_spin = arr_img(spin_focus(nascar, core=0.34, core_soft=0.60, strength=0.78, samples=44,
                                 leak=0.22, warmth=0.90, vig=0.34, haze=0.18, chroma=0.08))
    print('  color ramp…', flush=True)
    ef_ramp = arr_img(color_ramp(rx7, HVNTER_69, invert=True))
    print('  halfmode…', flush=True)
    ef_half = arr_img(halfmode(escada, cell=9))

    cenas = [
        (0.0, 2.8, lambda c, p: cena_intro(c, p)),
        (2.8, 7.6, lambda c, p: cena_efeito(c, p, 'nascar', 0.60, 0.52, 'EFEITO · STYLE',
                                            'Spin Focus Light Leak',
                                            'núcleo nítido + giro nas bordas', lambda p: ef_spin)),
        (7.6, 11.8, lambda c, p: cena_efeito(c, p, 'rx7', 0.46, 0.50, 'EFEITO · COLOR',
                                             'Color Ramp · HVNTER 69',
                                             'rampa de cor com Invert', lambda p: ef_ramp)),
        (11.8, 15.8, lambda c, p: cena_efeito(c, p, 'escada', 0.50, 0.46, 'EFEITO · PRINT',
                                              'HalfMode Studio',
                                              'duas tintas, retícula de pontos', lambda p: ef_half)),
        (15.8, 20.2, lambda c, p: cena_efeito(c, p, 'cosplay', 0.50, 0.42, 'EFEITO · GLITCH',
                                              'Glitch RGB', 'fatias, canais separados e scanlines',
                                              lambda p: arr_img(glitch(BASE_NP['cosplay'], 15.8 + p * 4.4)))),
        (20.2, 24.8, lambda c, p: cena_grafo(c, p)),
        (24.8, 30.0, lambda c, p: cena_final(c, p)),
    ]

    def quadro(i):
        t = i / FPS + 1e-6
        for k, (t0, t1, fn) in enumerate(cenas):
            if t0 <= t < t1:
                c = Cena(Image.new('RGB', (W, H), BG))
                p = (t - t0) / (t1 - t0)
                fn(c, p)
                if p < 0.05 and k > 0:
                    prev = Cena(Image.new('RGB', (W, H), BG))
                    cenas[k - 1][2](prev, 0.999)
                    c._image = Image.blend(prev._image, c._image, ease(p / 0.05))
                return pos_processa(c._image, t)
        return pos_processa(Image.new('RGB', (W, H), BG), DUR)

    if len(sys.argv) > 1 and sys.argv[1] == '--still':
        for s in sys.argv[2:]:
            quadro(int(float(s) * FPS)).save(os.path.join(AQUI, 'still_%s.png' % s))
            print('still', s)
        return

    out = os.path.join(AQUI, 'everything-editor-trailer.mp4')
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ff, '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H),
           '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium',
           '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    for i in range(N):
        pr.stdin.write(quadro(i).tobytes())
        if i % 120 == 0:
            print('frame %d/%d' % (i, N), flush=True)
    pr.stdin.close()
    err = pr.stderr.read().decode('utf8', 'ignore')
    pr.wait()
    if pr.returncode != 0:
        print(err[-2000:])
        raise SystemExit('ffmpeg falhou')
    print('ok', out, os.path.getsize(out))


if __name__ == '__main__':
    main()
