from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp" / "imagegen"
OUT = ROOT / "public" / "assets" / "maps" / "ashen"


def fit_alpha(source: str, output: str, size: int, occupancy: float) -> None:
    image = Image.open(SOURCE / source).convert("RGBA")
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        raise RuntimeError(f"{source} has no visible pixels")
    image = image.crop(bounds)
    target = int(size * occupancy)
    scale = min(target / image.width, target / image.height)
    resized = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - resized.width) // 2
    y = size - resized.height - round(size * (1 - occupancy) / 2)
    canvas.alpha_composite(resized, (x, y))
    canvas.save(OUT / output, optimize=True)


def floor_plate() -> None:
    image = Image.open(SOURCE / "ashen_floor_source.png").convert("RGB")
    target_ratio = 15 / 13
    crop_height = round(image.width / target_ratio)
    top = max(0, (image.height - crop_height) // 2)
    image = image.crop((0, top, image.width, top + crop_height))
    image = image.resize((1152, 1000), Image.Resampling.LANCZOS)
    image = ImageEnhance.Contrast(image).enhance(1.08)
    image = ImageEnhance.Sharpness(image).enhance(1.18)
    image.save(OUT / "premium_floor_plate.webp", "WEBP", quality=88, method=6)

    glow = image.filter(ImageFilter.GaussianBlur(8))
    glow = ImageEnhance.Color(glow).enhance(1.25)
    glow.save(OUT / "premium_floor_glow.webp", "WEBP", quality=72, method=6)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    floor_plate()
    fit_alpha("ashen_solid_alpha.png", "premium_solid.png", 384, 0.92)
    fit_alpha("ashen_block_alpha.png", "premium_destructible.png", 384, 0.9)
    fit_alpha("ashen_shrine_alpha.png", "premium_shrine.png", 512, 0.94)
