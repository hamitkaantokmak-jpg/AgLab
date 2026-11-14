"""AğLab ders şemaları için küçük SVG kütüphanesi.

Her ders `docs/dersler/gorseller/<konu>.py` içinde `FIGURES = {"g1": fn, ...}` tanımlar; her
fonksiyon bir `Fig` döndürür. `tools/build_figures.py` bunları `docs/dersler/gorseller/<konu>/<id>.svg`
olarak yazar; ders metni `![Başlık](gorseller/<konu>/<id>.svg)` ile kullanır.

Renkler CSS değişkenleridir (`--fig-*`): uygulamada tema (açık/koyu) belirler, dosya tek başına
açılınca (GitHub) değişkenlerin yedek değeri, yani açık tema kullanılır. Yazı Türkçe karakterli
olabilir; genişlik tahmini kaba bir karakter ölçüsüyle yapılır (`text_width`).
"""

from __future__ import annotations

import html
import math

# ad -> (dolgu değişkeni, dolgu yedeği, çizgi değişkeni, çizgi yedeği)
TONES = {
    "card": ("--fig-card", "#ffffff", "--fig-line", "#c9d1dc"),
    "soft": ("--fig-soft", "#f2f4f7", "--fig-line", "#c9d1dc"),
    "accent": ("--fig-accent-soft", "#e5ecff", "--fig-accent", "#3b6cf6"),
    "ok": ("--fig-ok-soft", "#dff5ea", "--fig-ok", "#1f9d6b"),
    "err": ("--fig-err-soft", "#fde4e4", "--fig-err", "#d64545"),
    "warn": ("--fig-warn-soft", "#fdf0d5", "--fig-warn", "#c98a12"),
    "v1": ("--fig-v1-soft", "#e3edff", "--fig-v1", "#2f6fe0"),
    "v2": ("--fig-v2-soft", "#dcf4e6", "--fig-v2", "#1d9a5b"),
    "v3": ("--fig-v3-soft", "#fde9d7", "--fig-v3", "#d9731a"),
    "v4": ("--fig-v4-soft", "#efe3fb", "--fig-v4", "#8a4fd0"),
    "none": ("--fig-none", "none", "--fig-line", "#c9d1dc"),
}

STYLE = (
    ".fg-t{fill:var(--fig-text,#1f2430);font-family:system-ui,-apple-system,'Segoe UI',sans-serif}"
    ".fg-m{fill:var(--fig-muted,#59606c)}"
    ".fg-mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}"
    ".fg-ln{stroke:var(--fig-line-strong,#8a94a3);fill:none}"
    + "".join(
        f".fg-{k}{{fill:var({f},{fb});stroke:var({s},{sb})}}"
        f".fg-{k}-s{{stroke:var({s},{sb});fill:none}}"
        f".fg-{k}-f{{fill:var({s},{sb})}}"
        f".fg-{k}-x{{fill:var({s},{sb})}}"
        for k, (f, fb, s, sb) in TONES.items()
    )
)


def esc(s: object) -> str:
    return html.escape(str(s), quote=True)


def text_width(s: str, size: float = 13, bold: bool = False) -> float:
    w = 0.0
    for ch in str(s):
        if ch in "il.,:;|!'`ı":
            w += 0.3
        elif ch in "mwMWŞĞÜÖ@%":
            w += 0.85
        elif ch.isupper() or ch.isdigit():
            w += 0.64
        elif ch == " ":
            w += 0.3
        else:
            w += 0.55
    return w * size * (1.07 if bold else 1.0)


def wrap(s: str, width: float, size: float = 13, bold: bool = False) -> list[str]:
    lines: list[str] = []
    for para in str(s).split("\n"):
        cur = ""
        for word in para.split(" "):
            cand = (cur + " " + word).strip()
            if cur and text_width(cand, size, bold) > width:
                lines.append(cur)
                cur = word
            else:
                cur = cand
        lines.append(cur)
    return lines


class Fig:
    """Bir şema. Koordinatlar piksel; `w`×`h` görünüm kutusu."""

    def __init__(self, w: int, h: int, title: str, desc: str = ""):
        self.w, self.h, self.title, self.desc = w, h, title, desc
        self.parts: list[str] = []
        self.defs: set[str] = set()

    # ------------------------------------------------------------------ ilkel parçalar
    def raw(self, s: str) -> "Fig":
        self.parts.append(s)
        return self

    def text(self, x, y, s, size=13, tone="t", anchor="middle", bold=False, mono=False, italic=False):
        cls = "fg-t" + ("" if tone == "t" else f" fg-{tone}-x" if tone in TONES else " fg-m")
        if mono:
            cls += " fg-mono"
        attrs = f'x="{x:.1f}" y="{y:.1f}" font-size="{size}" text-anchor="{anchor}" class="{cls}"'
        if bold:
            attrs += ' font-weight="700"'
        if italic:
            attrs += ' font-style="italic"'
        self.parts.append(f"<text {attrs}>{esc(s)}</text>")
        return self

    def lines(self, x, y, rows, size=13, gap=1.35, **kw):
        """Çok satırlı yazı; `y` ilk satırın taban çizgisi."""
        for i, r in enumerate(rows):
            self.text(x, y + i * size * gap, r, size=size, **kw)
        return self

    def rect(self, x, y, w, h, tone="card", r=10, dash=False, width=1.5):
        d = ' stroke-dasharray="6 5"' if dash else ""
        self.parts.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r}" '
            f'class="fg-{tone}" stroke-width="{width}"{d}/>'
        )
        return self

    def box(self, x, y, w, h, label="", tone="card", sub="", size=13, r=10, dash=False, bold=True):
        """Ortası yazılı kutu; `label` gerekirse satırlara bölünür."""
        self.rect(x, y, w, h, tone, r, dash)
        rows = wrap(label, w - 16, size, bold) if label else []
        subrows = wrap(sub, w - 16, size - 2) if sub else []
        total = len(rows) * size * 1.3 + len(subrows) * (size - 2) * 1.3
        cy = y + h / 2 - total / 2 + size * 0.95
        for i, r_ in enumerate(rows):
            self.text(x + w / 2, cy + i * size * 1.3, r_, size=size, bold=bold)
        cy += len(rows) * size * 1.3
        for i, r_ in enumerate(subrows):
            self.text(x + w / 2, cy + i * (size - 2) * 1.3, r_, size=size - 2, tone="m")
        return self

    def line(self, x1, y1, x2, y2, tone="ln", width=2, dash=False, arrow=False, both=False):
        cls = "fg-ln" if tone == "ln" else f"fg-{tone}-s"
        d = ' stroke-dasharray="7 6"' if dash else ""
        m = ""
        if arrow or both:
            mid = self._marker(tone)
            m = f' marker-end="url(#{mid})"' + (f' marker-start="url(#{mid}s)"' if both else "")
        self.parts.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" class="{cls}" '
            f'stroke-width="{width}" stroke-linecap="round"{d}{m}/>'
        )
        return self

    def path(self, d, tone="ln", width=2, dash=False, arrow=False):
        cls = "fg-ln" if tone == "ln" else f"fg-{tone}-s"
        da = ' stroke-dasharray="7 6"' if dash else ""
        m = f' marker-end="url(#{self._marker(tone)})"' if arrow else ""
        self.parts.append(f'<path d="{d}" class="{cls}" stroke-width="{width}" fill="none"{da}{m}/>')
        return self

    def _marker(self, tone):
        mid = "fga-" + tone
        cls = "fg-ln" if tone == "ln" else f"fg-{tone}-s"
        fill = "var(--fig-line-strong,#8a94a3)" if tone == "ln" else None
        if tone != "ln":
            _, _, s, sb = TONES[tone]
            fill = f"var({s},{sb})"
        self.defs.add(
            f'<marker id="{mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
            f'markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" '
            f'style="fill:{fill}"/></marker>'
            f'<marker id="{mid}s" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" '
            f'markerHeight="7" orient="auto"><path d="M10 0L0 5L10 10z" style="fill:{fill}"/></marker>'
        )
        del cls
        return mid

    def arrow(self, x1, y1, x2, y2, label="", tone="ln", width=2, dash=False, size=12, above=True, both=False):
        self.line(x1, y1, x2, y2, tone, width, dash, arrow=not both, both=both)
        if label:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            if abs(y2 - y1) < 4:
                self.text(mx, my - 8 if above else my + 18, label, size=size, tone="m" if tone == "ln" else tone)
            else:
                self.text(mx + 8, my, label, size=size, anchor="start", tone="m" if tone == "ln" else tone)
        return self

    def circle(self, x, y, r, tone="accent"):
        self.parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" class="fg-{tone}" stroke-width="1.5"/>')
        return self

    def badge(self, x, y, n, tone="accent", r=12):
        """Numaralı adım rozeti (dolu daire)."""
        _, _, s, sb = TONES[tone]
        self.parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" style="fill:var({s},{sb})"/>')
        self.parts.append(
            f'<text x="{x:.1f}" y="{y + 4.5:.1f}" font-size="{r + 1}" text-anchor="middle" '
            f'font-weight="700" style="fill:#fff;font-family:system-ui,sans-serif">{esc(n)}</text>'
        )
        return self

    def zone(self, x, y, w, h, label, tone="v1", label_pos="tl"):
        """Arka plan bölgesi (VLAN, alan, bina); köşede etiket."""
        self.rect(x, y, w, h, tone, r=14, dash=True, width=1.4)
        if label:
            lx = x + 12 if label_pos.endswith("l") else x + w - 12
            ly = y + 18 if label_pos.startswith("t") else y + h - 10
            self.text(lx, ly, label, size=12, tone=tone, anchor="start" if label_pos.endswith("l") else "end", bold=True)
        return self

    # ------------------------------------------------------------------ ağ parçaları
    def device(self, x, y, kind, name="", sub="", tone="card", w=None):
        """Cihaz kartı; (x, y) kartın merkezi. kind: pc, laptop, switch, l3switch, router, server,
        printer, phone, ap, cloud, firewall, wlc."""
        w = w or max(92, text_width(name, 13, True) + 28, text_width(sub, 11) + 22)
        h = 64 if sub else 54
        if kind == "cloud":
            self._cloud(x, y, w, h, tone)
        else:
            self.rect(x - w / 2, y - h / 2, w, h, tone, r=11)
        self._icon(kind, x, y - h / 2 + 15, tone)
        self.text(x, y - h / 2 + 37, name, size=13, bold=True)
        if sub:
            self.text(x, y - h / 2 + 53, sub, size=11, tone="m")
        return (x, y, w, h)

    def _cloud(self, x, y, w, h, tone):
        f, fb, s, sb = TONES[tone]
        rx, ry = w / 2, h / 2
        d = (
            f"M{x - rx + 14:.1f} {y + ry:.1f} "
            f"a{ry * 0.62:.1f} {ry * 0.62:.1f} 0 0 1 {-4:.1f} {-ry * 1.1:.1f} "
            f"a{rx * 0.45:.1f} {ry * 0.7:.1f} 0 0 1 {rx * 0.75:.1f} {-ry * 0.75:.1f} "
            f"a{rx * 0.5:.1f} {ry * 0.7:.1f} 0 0 1 {rx * 0.95:.1f} {ry * 0.15:.1f} "
            f"a{ry * 0.7:.1f} {ry * 0.7:.1f} 0 0 1 {rx * 0.25:.1f} {ry * 1.7:.1f}z"
        )
        self.parts.append(f'<path d="{d}" class="fg-{tone}" stroke-width="1.5"/>')

    def _icon(self, kind, x, y, tone):
        s = "fg-accent-s" if tone in ("card", "soft") else f"fg-{tone}-s"
        f = "fg-accent-f" if tone in ("card", "soft") else f"fg-{tone}-f"
        p = self.parts
        if kind in ("pc", "laptop"):
            p.append(f'<rect x="{x - 9}" y="{y - 7}" width="18" height="12" rx="2" class="{s}" stroke-width="1.6"/>')
            p.append(f'<line x1="{x - 5}" y1="{y + 8}" x2="{x + 5}" y2="{y + 8}" class="{s}" stroke-width="1.6"/>')
        elif kind in ("switch", "l3switch"):
            p.append(f'<rect x="{x - 12}" y="{y - 6}" width="24" height="12" rx="2" class="{s}" stroke-width="1.6"/>')
            for dx in (-6, 0, 6):
                p.append(f'<rect x="{x + dx - 2}" y="{y - 1}" width="4" height="3" class="{f}"/>')
            if kind == "l3switch":
                p.append(f'<text x="{x + 17}" y="{y + 4}" font-size="9" class="{f}" font-weight="700" style="font-family:system-ui">L3</text>')
        elif kind == "router":
            p.append(f'<circle cx="{x}" cy="{y}" r="8" class="{s}" stroke-width="1.6"/>')
            p.append(f'<path d="M{x - 5} {y}h10M{x} {y - 5}v10" class="{s}" stroke-width="1.6"/>')
        elif kind == "server":
            p.append(f'<rect x="{x - 7}" y="{y - 8}" width="14" height="16" rx="2" class="{s}" stroke-width="1.6"/>')
            p.append(f'<path d="M{x - 7} {y - 2}h14M{x - 7} {y + 3}h14" class="{s}" stroke-width="1.3"/>')
        elif kind == "printer":
            p.append(f'<rect x="{x - 9}" y="{y - 3}" width="18" height="9" rx="2" class="{s}" stroke-width="1.6"/>')
            p.append(f'<rect x="{x - 5}" y="{y - 8}" width="10" height="5" class="{s}" stroke-width="1.4"/>')
        elif kind == "phone":
            p.append(f'<rect x="{x - 5}" y="{y - 8}" width="10" height="16" rx="2.5" class="{s}" stroke-width="1.6"/>')
        elif kind in ("ap", "wlc"):
            p.append(f'<path d="M{x - 9} {y - 1}a12 12 0 0 1 18 0M{x - 5} {y + 3}a6 6 0 0 1 10 0" class="{s}" stroke-width="1.6"/>')
            p.append(f'<circle cx="{x}" cy="{y + 6}" r="2" class="{f}"/>')
        elif kind == "firewall":
            p.append(f'<rect x="{x - 10}" y="{y - 7}" width="20" height="14" class="{s}" stroke-width="1.6"/>')
            p.append(f'<path d="M{x - 10} {y}h20M{x - 3} {y - 7}v7M{x + 4} {y}v7" class="{s}" stroke-width="1.3"/>')
        elif kind == "cloud":
            pass

    def link(self, a, b, label="", la="", lb="", tone="ln", width=2.2, dash=False, blocked=False, size=11):
        """İki cihaz kartı arasında kablo; a/b `device` dönüşü. la/lb uç etiketleri (port adları)."""
        (x1, y1, w1, h1), (x2, y2, w2, h2) = a, b
        p1 = self._edge(x1, y1, w1, h1, x2, y2)
        p2 = self._edge(x2, y2, w2, h2, x1, y1)
        self.line(*p1, *p2, tone=tone, width=width, dash=dash)
        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        ln = math.hypot(dx, dy) or 1
        ux, uy = dx / ln, dy / ln
        nx, ny = -uy, ux
        if abs(dy) < 3:  # yatay: etiketler kablonun üstünde
            nx, ny = 0, -1
        off = 10
        if la:
            self.text(p1[0] + ux * 20 + nx * off, p1[1] + uy * 20 + ny * off + 4, la, size=size, tone="m")
        if lb:
            self.text(p2[0] - ux * 20 + nx * off, p2[1] - uy * 20 + ny * off + 4, lb, size=size, tone="m")
        if label:
            mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
            tw = text_width(label, size, True) + 12
            self.rect(mx - tw / 2, my - 10, tw, 20, "card" if tone == "ln" else tone, r=10, width=1)
            self.text(mx, my + 4, label, size=size, bold=True, tone="t")
        if blocked:
            mx, my = p1[0] + ux * 34, p1[1] + uy * 34
            self.circle(mx, my, 9, "err")
            self.line(mx - 5, my - 5, mx + 5, my + 5, "err", 2.2)
            self.line(mx - 5, my + 5, mx + 5, my - 5, "err", 2.2)
        return self

    @staticmethod
    def _edge(x, y, w, h, tx, ty):
        dx, dy = tx - x, ty - y
        if dx == 0 and dy == 0:
            return (x, y)
        sx = (w / 2) / abs(dx) if dx else math.inf
        sy = (h / 2) / abs(dy) if dy else math.inf
        s = min(sx, sy)
        return (x + dx * s, y + dy * s)

    def frame(self, x, y, fields, h=46, size=12, title=""):
        """Çerçeve/paket yapısı: fields = [(ad, genişlik, ton, alt yazı), ...]."""
        if title:
            self.text(x, y - 10, title, size=12, tone="m", anchor="start", bold=True)
        cx = x
        for f in fields:
            name, w = f[0], f[1]
            tone = f[2] if len(f) > 2 else "card"
            sub = f[3] if len(f) > 3 else ""
            self.rect(cx, y, w, h, tone, r=4)
            if sub:
                self.text(cx + w / 2, y + h / 2 - 2, name, size=size, bold=True)
                self.text(cx + w / 2, y + h / 2 + 13, sub, size=size - 2, tone="m")
            else:
                self.text(cx + w / 2, y + h / 2 + 4, name, size=size, bold=True)
            cx += w
        return cx

    def packet(self, x, y, label, tone="accent", w=None):
        """Küçük paket/zarf rozeti; (x, y) merkez."""
        w = w or text_width(label, 11, True) + 26
        self.rect(x - w / 2, y - 11, w, 22, tone, r=5)
        self.path(f"M{x - w / 2 + 6} {y - 6}l6 5l6 -5", tone=tone if tone in TONES else "ln", width=1.3)
        self.text(x + 8, y + 4, label, size=11, bold=True)
        return self

    def table(self, x, y, headers, rows, widths, row_h=28, size=12, tones=None, mono_cols=()):
        """Basit tablo; tones: satır indeksi -> ton (vurgulu satır)."""
        tones = tones or {}
        total = sum(widths)
        self.rect(x, y, total, row_h, "accent", r=4)
        cx = x
        for hd, w in zip(headers, widths):
            self.text(cx + 8, y + row_h / 2 + 4, hd, size=size, anchor="start", bold=True)
            cx += w
        for i, row in enumerate(rows):
            ry = y + row_h * (i + 1)
            self.rect(x, ry, total, row_h, tones.get(i, "card"), r=0, width=1)
            cx = x
            for j, (cell, w) in enumerate(zip(row, widths)):
                self.text(cx + 8, ry + row_h / 2 + 4, cell, size=size, anchor="start", mono=j in mono_cols)
                cx += w
        return y + row_h * (len(rows) + 1)

    def note(self, x, y, w, s, tone="warn", size=12, title=""):
        """Not kutusu (sol kenarı renkli); yüksekliği yazıya göre."""
        rows = wrap(s, w - 24, size)
        h = len(rows) * size * 1.35 + 16 + (size * 1.4 if title else 0)
        self.rect(x, y, w, h, tone, r=8, width=1.2)
        ty = y + size + 8
        if title:
            self.text(x + 12, ty, title, size=size, bold=True, anchor="start", tone=tone)
            ty += size * 1.4
        self.lines(x + 12, ty, rows, size=size, anchor="start")
        return y + h

    def caption(self, s, size=12):
        """Alt kenarda tek satırlık ana mesaj."""
        self.text(self.w / 2, self.h - 10, s, size=size, tone="m", italic=True)
        return self

    # ------------------------------------------------------------------ çıktı
    def svg(self, uid: str = "fg") -> str:
        """`uid` sayfadaki kimliklerin (title/desc) tekil olması için (ör. "vlan-trunk-g1")."""
        defs = f"<defs>{''.join(sorted(self.defs))}</defs>" if self.defs else ""
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" '
            f'width="{self.w}" height="{self.h}" role="img" aria-labelledby="{uid}-t {uid}-d" class="fg">'
            f'<title id="{uid}-t">{esc(self.title)}</title>'
            f'<desc id="{uid}-d">{esc(self.desc or self.title)}</desc>'
            f"<style>{STYLE}</style>{defs}{''.join(self.parts)}</svg>\n"
        )
