"""Builds deck assets: transparent logos cut from the official event banner, and light glassmorphism backgrounds."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

A = "assets/"
banner = Image.open(A + "banner.png").convert("RGB")


def knockout_white(img: Image.Image, scale: int = 3) -> Image.Image:
    """White -> transparent with colour un-premultiply, so anti-aliased edges stay clean on any background."""
    img = img.resize((img.width * scale, img.height * scale), Image.LANCZOS)
    a = np.asarray(img).astype(np.float32) / 255.0
    alpha = 1.0 - a.min(axis=2)
    alpha = np.clip((alpha - 0.02) / 0.98, 0, 1)
    safe = np.where(alpha > 1e-3, alpha, 1)[..., None]
    rgb = np.clip((a - (1 - alpha[..., None])) / safe, 0, 1)
    out = np.dstack([rgb, alpha]) * 255
    im = Image.fromarray(out.astype(np.uint8), "RGBA")
    return im.crop(im.getbbox())


knockout_white(banner.crop((440, 55, 890, 195))).save(A + "logo_hackathon.png")
knockout_white(banner.crop((960, 50, 1145, 195))).save(A + "logo_build_for_india.png")
knockout_white(banner.crop((515, 60, 672, 120))).save(A + "logo_paytm.png")
knockout_white(banner.crop((420, 368, 1160, 581)), scale=2).save(A + "skyline.png")

W, H = 1920, 1080
NAVY = (0, 46, 110)
CYAN = (0, 186, 242)


def blob(canvas, xy, r, color, alpha):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = xy
    d.ellipse((x - r, y - r, x + r, y + r), fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(r * 0.55))
    canvas.alpha_composite(layer)


def dots(canvas, step=34, color=(0, 46, 110), alpha=16, region=None):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = region or (0, 0, W, H)
    for y in range(y0, y1, step):
        for x in range(x0, x1, step):
            d.ellipse((x - 1.6, y - 1.6, x + 1.6, y + 1.6), fill=color + (alpha,))
    canvas.alpha_composite(layer)


def ribbon(canvas, bbox, start, end, width, color, alpha=255):
    layer = Image.new("RGBA", (canvas.width * 2, canvas.height * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    b = tuple(v * 2 for v in bbox)
    d.arc(b, start, end, fill=color + (alpha,), width=width * 2)
    layer = layer.resize(canvas.size, Image.LANCZOS)
    canvas.alpha_composite(layer)


def base():
    c = Image.new("RGBA", (W, H), (246, 250, 253, 255))
    grad = np.linspace(0, 1, H)[:, None] * np.ones((1, W))
    top = np.array([236, 248, 254])
    bot = np.array([244, 247, 252])
    arr = (top[None, None] * (1 - grad[..., None]) + bot[None, None] * grad[..., None]).astype(np.uint8)
    c.alpha_composite(Image.fromarray(np.dstack([arr, np.full((H, W), 255, np.uint8)]), "RGBA"))
    return c


# Title / closing background: banner-style ribbons + glows
t = base()
blob(t, (1700, 120), 380, CYAN, 120)
blob(t, (180, 980), 420, NAVY, 70)
blob(t, (1500, 900), 300, (93, 211, 248), 90)
dots(t, alpha=14)
ribbon(t, (-560, 830, 300, 1690), 280, 80, 110, NAVY, 235)
ribbon(t, (-700, 960, 300, 1960), 270, 60, 110, CYAN, 235)
ribbon(t, (1560, 640, 2260, 1340), 180, 300, 110, (40, 66, 196), 225)
ribbon(t, (1440, 520, 2000, 1080), 160, 260, 70, (190, 233, 250), 255)
ribbon(t, (1620, -520, 2420, 230), 95, 185, 95, (234, 84, 85), 245)
t.convert("RGB").save(A + "bg_title.png", quality=95)

# Content background: calm glows + dot grid
c = base()
blob(c, (1820, 60), 330, CYAN, 70)
blob(c, (80, 1060), 360, NAVY, 38)
blob(c, (1100, 1120), 300, (93, 211, 248), 45)
dots(c, alpha=11)
c.convert("RGB").save(A + "bg_content.png", quality=95)

# Section divider background: navy-to-cyan glass field
s = Image.new("RGBA", (W, H), NAVY + (255,))
blob(s, (1650, 200), 520, CYAN, 170)
blob(s, (300, 1000), 480, (13, 76, 160), 200)
blob(s, (1100, 700), 300, (0, 140, 210), 120)
dots(s, color=(255, 255, 255), alpha=18)
ribbon(s, (-600, 500, 500, 1600), 280, 80, 110, CYAN, 200)
s.convert("RGB").save(A + "bg_section.png", quality=95)
print("assets ok")
