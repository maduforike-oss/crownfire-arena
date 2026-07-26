from __future__ import annotations

import math
import random
from pathlib import Path
from typing import Iterable, Tuple

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "maps"


Color = Tuple[int, int, int, int]


THEMES = {
    "ashen": {
        "base": (37, 32, 34),
        "dark": (14, 12, 14),
        "stone": (70, 61, 62),
        "block": (92, 57, 42),
        "accent": (240, 104, 45),
        "hot": (255, 183, 70),
        "symbol": "ember",
    },
    "moonfang": {
        "base": (31, 42, 49),
        "dark": (10, 15, 19),
        "stone": (55, 68, 72),
        "block": (61, 77, 54),
        "accent": (142, 190, 255),
        "hot": (205, 228, 255),
        "symbol": "moon",
    },
    "frostkeep": {
        "base": (32, 45, 55),
        "dark": (9, 16, 22),
        "stone": (71, 91, 101),
        "block": (81, 113, 125),
        "accent": (124, 228, 255),
        "hot": (231, 250, 255),
        "symbol": "frost",
    },
    "hollowmoon": {
        "base": (35, 32, 48),
        "dark": (11, 9, 16),
        "stone": (73, 64, 86),
        "block": (83, 74, 91),
        "accent": (169, 116, 255),
        "hot": (224, 195, 255),
        "symbol": "veil",
    },
}


def clamp(v: int) -> int:
    return max(0, min(255, v))


def rgba(rgb: Iterable[int], a: int = 255) -> Color:
    r, g, b = rgb
    return (r, g, b, a)


def shift(rgb: Iterable[int], amount: int) -> Tuple[int, int, int]:
    r, g, b = rgb
    return (clamp(r + amount), clamp(g + amount), clamp(b + amount))


def noise_overlay(img: Image.Image, amount: int, seed: int) -> None:
    rnd = random.Random(seed)
    px = img.load()
    width, height = img.size
    for y in range(height):
      for x in range(width):
        r, g, b, a = px[x, y]
        n = rnd.randint(-amount, amount)
        px[x, y] = (clamp(r + n), clamp(g + n), clamp(b + n), a)


def glow_layer(size: Tuple[int, int], color: Tuple[int, int, int], spots: list[tuple[int, int, int, int]]) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    for x, y, radius, alpha in spots:
        d.ellipse((x - radius, y - radius, x + radius, y + radius), fill=rgba(color, alpha))
    return layer.filter(ImageFilter.GaussianBlur(10))


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def floor_tile(theme_id: str, data: dict, variant: int) -> Image.Image:
    size = 96
    base = shift(data["base"], variant * 5 - 4)
    img = Image.new("RGBA", (size, size), rgba(base))
    d = ImageDraw.Draw(img, "RGBA")
    noise_overlay(img, 13, hash((theme_id, "floor", variant)) & 0xFFFFFFFF)

    d.rectangle((2, 2, size - 3, size - 3), outline=rgba(data["dark"], 175), width=3)
    d.line((6, 7, 88, 5), fill=(255, 255, 255, 20), width=2)
    d.line((6, 8, 5, 88), fill=(255, 255, 255, 15), width=2)
    d.line((10, 48, 88, 46), fill=(0, 0, 0, 55), width=2)
    d.line((47, 10, 49, 88), fill=(0, 0, 0, 45), width=2)

    rnd = random.Random(hash((theme_id, variant, "cracks")) & 0xFFFFFFFF)
    for _ in range(4):
        x, y = rnd.randint(10, 86), rnd.randint(10, 86)
        points = [(x, y)]
        for _seg in range(rnd.randint(2, 4)):
            x += rnd.randint(-18, 18)
            y += rnd.randint(-12, 12)
            points.append((max(7, min(89, x)), max(7, min(89, y))))
        d.line(points, fill=rgba(data["dark"], 120), width=2)
        if rnd.random() < 0.55:
            d.line(points, fill=rgba(data["accent"], 50 if theme_id != "ashen" else 95), width=1)

    symbol = data["symbol"]
    if symbol == "moon":
        d.arc((58, 15, 82, 39), 75, 285, fill=rgba(data["accent"], 85), width=3)
    elif symbol == "frost":
        d.line((18, 22, 44, 34, 74, 25), fill=rgba(data["hot"], 70), width=2)
        d.line((42, 35, 52, 22), fill=rgba(data["hot"], 55), width=1)
    elif symbol == "veil":
        d.ellipse((62, 61, 78, 77), outline=rgba(data["accent"], 65), width=2)
    else:
        d.line((17, 75, 38, 51, 72, 44), fill=rgba(data["accent"], 95), width=2)

    return img


def solid_tile(theme_id: str, data: dict) -> Image.Image:
    img = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse((13, 70, 83, 93), fill=(0, 0, 0, 105))
    d.rounded_rectangle((10, 8, 86, 82), radius=5, fill=rgba(data["stone"]), outline=rgba(data["dark"]), width=4)
    noise_overlay(img, 10, hash((theme_id, "solid")) & 0xFFFFFFFF)
    d.rectangle((15, 14, 81, 79), outline=(255, 255, 255, 22), width=2)
    for y in (32, 54):
        d.line((16, y, 80, y + 2), fill=(0, 0, 0, 70), width=3)
    for x in (34, 60):
        d.line((x, 15, x - 2, 79), fill=(0, 0, 0, 55), width=2)

    if data["symbol"] == "frost":
        d.polygon([(67, 8), (84, 35), (56, 30)], fill=rgba(data["accent"], 150))
        d.line((68, 11, 63, 43), fill=rgba(data["hot"], 115), width=2)
    elif data["symbol"] == "moon":
        d.polygon([(48, 18), (60, 39), (48, 63), (36, 39)], outline=rgba(data["accent"], 130))
        d.ellipse((39, 30, 57, 48), outline=rgba(data["accent"], 110), width=2)
    elif data["symbol"] == "veil":
        d.ellipse((30, 25, 66, 61), outline=rgba(data["accent"], 110), width=3)
        d.line((48, 14, 48, 72), fill=rgba(data["accent"], 80), width=2)
    else:
        d.ellipse((22, 18, 38, 34), fill=rgba(data["accent"], 105))
        d.line((24, 28, 42, 41, 71, 34), fill=rgba(data["accent"], 75), width=3)
    return img


def block_tile(theme_id: str, data: dict) -> Image.Image:
    img = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse((17, 70, 79, 91), fill=(0, 0, 0, 115))
    d.rounded_rectangle((17, 14, 79, 75), radius=4, fill=rgba(data["block"]), outline=rgba(data["dark"]), width=4)
    noise_overlay(img, 12, hash((theme_id, "block")) & 0xFFFFFFFF)
    d.line((23, 28, 41, 43, 63, 34, 73, 48), fill=rgba(data["dark"], 150), width=3)
    d.line((23, 28, 41, 43, 63, 34), fill=rgba(data["accent"], 75), width=2)
    d.rectangle((23, 20, 73, 69), outline=(255, 255, 255, 25), width=2)
    if data["symbol"] == "moon":
        d.ellipse((25, 53, 39, 67), fill=(72, 100, 58, 145))
        d.line((33, 59, 48, 49), fill=(100, 132, 79, 120), width=3)
    elif data["symbol"] == "frost":
        d.line((28, 61, 70, 28), fill=rgba(data["hot"], 95), width=2)
        d.line((45, 46, 39, 31), fill=rgba(data["hot"], 75), width=1)
    elif data["symbol"] == "veil":
        d.ellipse((36, 30, 60, 54), outline=rgba(data["accent"], 105), width=3)
    else:
        d.ellipse((55, 46, 69, 60), fill=rgba(data["accent"], 105))
        d.ellipse((58, 49, 66, 57), fill=rgba(data["hot"], 120))
    return img


def spawn_pad(theme_id: str, data: dict) -> Image.Image:
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle((16, 16, 112, 112), radius=9, fill=rgba(data["dark"], 180), outline=rgba(data["accent"], 175), width=4)
    d.rectangle((25, 25, 103, 103), outline=(255, 255, 255, 24), width=2)
    d.ellipse((37, 37, 91, 91), outline=rgba(data["accent"], 130), width=4)
    if data["symbol"] == "moon":
        d.ellipse((50, 47, 78, 75), fill=rgba(data["accent"], 120))
        d.ellipse((59, 41, 86, 70), fill=rgba(data["dark"], 230))
        for x, y in [(46, 80), (58, 85), (70, 85), (82, 80)]:
            d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=rgba(data["accent"], 105))
    elif data["symbol"] == "frost":
        for angle in range(0, 180, 45):
            r = math.radians(angle)
            d.line((64 - math.cos(r) * 28, 64 - math.sin(r) * 28, 64 + math.cos(r) * 28, 64 + math.sin(r) * 28), fill=rgba(data["hot"], 130), width=3)
    elif data["symbol"] == "veil":
        d.arc((42, 34, 86, 78), 65, 300, fill=rgba(data["accent"], 150), width=5)
        d.line((64, 36, 64, 91), fill=rgba(data["accent"], 105), width=3)
    else:
        d.polygon([(64, 36), (86, 64), (64, 92), (42, 64)], outline=rgba(data["hot"], 170))
        d.line((64, 44, 64, 85), fill=rgba(data["accent"], 140), width=4)
    return img


def shrine(theme_id: str, data: dict) -> Image.Image:
    img = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    img.alpha_composite(glow_layer((192, 192), data["accent"], [(96, 96, 56, 120)]))
    d.ellipse((19, 126, 173, 174), fill=(0, 0, 0, 120))
    d.ellipse((28, 28, 164, 164), fill=rgba(data["dark"], 220), outline=rgba(data["stone"], 230), width=7)
    d.ellipse((43, 43, 149, 149), outline=rgba(data["accent"], 210), width=5)
    d.ellipse((61, 61, 131, 131), outline=rgba(data["accent"], 130), width=3)
    for angle in range(0, 360, 45):
        r = math.radians(angle)
        d.line((96, 96, 96 + math.cos(r) * 55, 96 + math.sin(r) * 55), fill=rgba(data["accent"], 95), width=3)
    if data["symbol"] == "moon":
        d.ellipse((71, 67, 119, 115), outline=rgba(data["hot"], 180), width=6)
        d.ellipse((88, 57, 135, 106), fill=rgba(data["dark"], 240))
    elif data["symbol"] == "frost":
        for angle in range(0, 180, 30):
            r = math.radians(angle)
            d.line((96 - math.cos(r) * 37, 96 - math.sin(r) * 37, 96 + math.cos(r) * 37, 96 + math.sin(r) * 37), fill=rgba(data["hot"], 185), width=4)
    elif data["symbol"] == "veil":
        d.polygon([(96, 55), (127, 96), (96, 137), (65, 96)], outline=rgba(data["hot"], 180))
        d.ellipse((79, 80, 113, 114), outline=rgba(data["accent"], 170), width=4)
    else:
        d.polygon([(96, 51), (132, 96), (96, 141), (60, 96)], outline=rgba(data["hot"], 190))
        d.line((96, 58, 96, 132), fill=rgba(data["accent"], 175), width=5)
    return img


def border_panel(theme_id: str, data: dict) -> Image.Image:
    img = Image.new("RGBA", (192, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle((0, 36, 192, 96), fill=rgba(data["dark"], 245))
    d.rectangle((0, 28, 192, 44), fill=rgba(data["stone"], 230))
    for x in range(0, 192, 24):
        d.rectangle((x + 2, 20, x + 18, 58), fill=rgba(shift(data["stone"], random.Random(x).randint(-10, 8)), 230), outline=rgba(data["dark"], 200), width=2)
    for x in (42, 96, 150):
        d.ellipse((x - 9, 12, x + 9, 30), fill=rgba(data["accent"], 135))
        d.line((x, 30, x, 55), fill=rgba(data["accent"], 75), width=3)
    if theme_id in ("ashen", "hollowmoon"):
        for x in (64, 128):
            d.polygon([(x - 11, 42), (x + 11, 42), (x + 8, 76), (x, 68), (x - 8, 76)], fill=rgba(data["accent"], 80))
    return img


def landscape(theme_id: str, data: dict) -> Image.Image:
    img = Image.new("RGBA", (320, 520), rgba(data["dark"], 255))
    d = ImageDraw.Draw(img, "RGBA")
    for y in range(520):
        t = y / 520
        col = tuple(clamp(int(data["dark"][i] * (1 - t) + data["base"][i] * t)) for i in range(3))
        d.line((0, y, 320, y), fill=rgba(col, 255))
    img.alpha_composite(glow_layer((320, 520), data["accent"], [(160, 220, 90, 75), (230, 95, 55, 55)]))
    for i in range(7):
        x = 20 + i * 45
        h = 120 + (i % 3) * 48
        d.rectangle((x, 260 - h, x + 30, 420), fill=rgba(shift(data["stone"], -18), 190))
        d.polygon([(x - 9, 260 - h), (x + 15, 220 - h), (x + 39, 260 - h)], fill=rgba(shift(data["stone"], 4), 210))
        d.ellipse((x + 6, 247 - h, x + 24, 265 - h), fill=rgba(data["accent"], 135))
    if theme_id == "ashen":
        d.polygon([(70, 430), (170, 170), (276, 430)], fill=(82, 42, 33, 190))
        d.line((170, 170, 204, 430), fill=rgba(data["accent"], 120), width=5)
    elif theme_id == "moonfang":
        d.ellipse((192, 58, 268, 134), fill=(225, 238, 255, 160))
        d.ellipse((215, 44, 292, 121), fill=rgba(data["dark"], 220))
    elif theme_id == "frostkeep":
        for x in (70, 130, 220):
            d.polygon([(x, 100), (x + 20, 25), (x + 40, 100)], fill=rgba(data["accent"], 145))
    else:
        d.arc((118, 52, 218, 152), 62, 300, fill=rgba(data["accent"], 180), width=8)
    d.rectangle((8, 8, 312, 512), outline=rgba(data["accent"], 80), width=2)
    noise_overlay(img, 7, hash((theme_id, "landscape")) & 0xFFFFFFFF)
    return img


def main() -> None:
    for theme_id, data in THEMES.items():
        folder = OUT / theme_id
        for variant in range(3):
            save(floor_tile(theme_id, data, variant), folder / f"floor_{variant}.png")
        save(solid_tile(theme_id, data), folder / "solid.png")
        save(block_tile(theme_id, data), folder / "destructible.png")
        save(spawn_pad(theme_id, data), folder / "spawn_pad.png")
        save(shrine(theme_id, data), folder / "shrine.png")
        save(border_panel(theme_id, data), folder / "border.png")
        save(landscape(theme_id, data), folder / "landscape.png")


if __name__ == "__main__":
    main()
