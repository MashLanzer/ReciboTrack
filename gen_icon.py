"""
ReciboTrack icon v2 — Abstract geometric "flow bars"
Dark navy (#0B1020), Cyan (#00D4FF) → Emerald (#00C896)
"""
from PIL import Image, ImageDraw
import os, math

NAVY   = (11, 16, 32)
CYAN   = (0, 212, 255)
EMERALD = (0, 200, 150)
MID    = (0, 206, 202)  # midpoint


def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def draw_bars(draw, size):
    """
    Three horizontal rounded bars, left-aligned, decreasing width.
    Top → Cyan, Middle → interpolated, Bottom → Emerald.
    Proportions are in a 512×512 reference grid, then scaled.
    """
    s = size / 512.0

    bar_h   = round(74 * s)
    gap     = round(46 * s)
    pad_x   = round(76 * s)
    n_bars  = 3
    total_h = n_bars * bar_h + (n_bars - 1) * gap
    y0      = (size - total_h) // 2
    avail_w = size - 2 * pad_x

    widths = [1.0, 0.65, 0.38]
    colors = [CYAN, lerp(CYAN, EMERALD, 0.5), EMERALD]

    for i in range(n_bars):
        y     = y0 + i * (bar_h + gap)
        bar_w = round(avail_w * widths[i])
        r     = bar_h // 2
        c     = colors[i] + (255,)
        draw.rounded_rectangle([pad_x, y, pad_x + bar_w, y + bar_h], radius=r, fill=c)


def make_solid(size):
    img = Image.new("RGBA", (size, size), NAVY + (255,))
    draw_bars(ImageDraw.Draw(img), size)
    return img


def make_transparent(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_bars(ImageDraw.Draw(img), size)
    return img


out = "/home/user/ReciboTrack/icons_v2"
os.makedirs(out, exist_ok=True)

sizes = [512, 192, 144, 96, 72, 48]

for sz in sizes:
    make_solid(sz).save(f"{out}/icon_{sz}x{sz}.png")
    make_transparent(sz).save(f"{out}/icon_{sz}x{sz}_transparent.png")
    print(f"  {sz}×{sz} ✓")

# Android adaptive icon (108dp × 4 = 432px, mark centred in safe zone 66%)
adaptive_sz = 432
fg = Image.new("RGBA", (adaptive_sz, adaptive_sz), (0, 0, 0, 0))
draw_bars(ImageDraw.Draw(fg), adaptive_sz)
fg.save(f"{out}/icon_adaptive_foreground.png")

bg = Image.new("RGBA", (adaptive_sz, adaptive_sz), NAVY + (255,))
bg.save(f"{out}/icon_adaptive_background.png")
print("  adaptive ✓")

print(f"\nAll icons saved → {out}")
