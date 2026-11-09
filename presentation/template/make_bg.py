"""Clean aurora backgrounds in the PARAM Shavak light style (no glass panels)."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

W, H = 2400, 1350
BASE = (243, 246, 253)
LAV = (221, 218, 255)
BLUE = (126, 166, 255)
DEEP = (79, 134, 255)
SKY = (187, 215, 253)


def canvas():
    c = Image.new("RGBA", (W, H), BASE + (255,))
    return c


def _paint(c, color, mask, blur):
    layer = Image.new("RGBA", c.size, color + (0,))
    layer.putalpha(mask.filter(ImageFilter.GaussianBlur(blur)))
    c.alpha_composite(layer)


def blob(c, x, y, rx, ry, color, alpha, blur):
    mask = Image.new("L", c.size, 0)
    ImageDraw.Draw(mask).ellipse((x - rx, y - ry, x + rx, y + ry), fill=alpha)
    _paint(c, color, mask, blur)


def sweep(c, bbox, start, end, width, color, alpha, blur):
    """A soft luminous ribbon: a thick arc blurred heavily, like the reference aurora."""
    mask = Image.new("L", c.size, 0)
    ImageDraw.Draw(mask).arc(bbox, start, end, fill=alpha, width=width)
    _paint(c, color, mask, blur)


def grain(c, amount=2.2):
    a = np.asarray(c).astype(np.float32)
    n = np.random.default_rng(7).normal(0, amount, a.shape[:2])[..., None]
    a[..., :3] = np.clip(a[..., :3] + n, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def save(c, name):
    grain(c).convert("RGB").save(f"bg_{name}.jpg", quality=90, subsampling=0)


# cover: strong sweep on the right, lavender haze at the top
c = canvas()
blob(c, 1250, -120, 900, 260, LAV, 230, 160)
sweep(c, (1250, -300, 3300, 1700), 100, 260, 260, BLUE, 200, 110)
sweep(c, (900, 350, 2700, 2200), 180, 330, 200, DEEP, 120, 130)
blob(c, 2250, 1250, 520, 300, SKY, 200, 160)
blob(c, 200, 1300, 600, 220, SKY, 150, 160)
save(c, "cover")

# content: quiet edges, clean centre for text
c = canvas()
blob(c, 1100, -140, 1000, 230, LAV, 200, 170)
sweep(c, (-900, 700, 1300, 2700), 300, 40, 230, BLUE, 110, 140)
sweep(c, (1700, -900, 3500, 800), 120, 230, 220, BLUE, 120, 140)
blob(c, 2300, 1300, 600, 260, SKY, 170, 170)
save(c, "content")

# section divider: a bolder diagonal aurora
c = canvas()
blob(c, 1500, -100, 1000, 300, LAV, 240, 170)
sweep(c, (-400, -200, 2100, 2300), 290, 70, 330, DEEP, 170, 120)
sweep(c, (900, 300, 3200, 2600), 190, 300, 260, BLUE, 170, 130)
blob(c, 2200, 200, 420, 300, SKY, 200, 160)
save(c, "section")

# closing: centred glow
c = canvas()
blob(c, 1200, -100, 1100, 280, LAV, 230, 170)
sweep(c, (300, 600, 2100, 2300), 190, 350, 280, BLUE, 160, 130)
blob(c, 300, 300, 500, 400, SKY, 150, 170)
blob(c, 2150, 380, 520, 420, SKY, 170, 170)
save(c, "closing")
print("backgrounds ok")
