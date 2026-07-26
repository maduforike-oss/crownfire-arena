from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp" / "imagegen"
MAPS = ROOT / "public" / "assets" / "maps"

KITS = {
    "moonfang": ("moonfang_floor_source.png", "moonfang_objects_alpha.png"),
    "frostkeep": ("frostkeep_floor_source.png", "frostkeep_objects_alpha.png"),
    "hollowmoon": ("hollowmoon_floor_source.png", "hollowmoon_objects_alpha.png"),
}


def floor_plate(source: Path, output: Path) -> None:
    image = Image.open(source).convert("RGB")
    target_ratio = 15 / 13
    crop_height = round(image.width / target_ratio)
    top = max(0, (image.height - crop_height) // 2)
    image = image.crop((0, top, image.width, top + crop_height))
    image = image.resize((1152, 1000), Image.Resampling.LANCZOS)
    image = ImageEnhance.Contrast(image).enhance(1.08)
    image = image.filter(ImageFilter.UnsharpMask(radius=1.1, percent=145, threshold=3))
    image.save(output, "WEBP", quality=87, method=6)


def fit_object(image: Image.Image, size: int, occupancy: float) -> Image.Image:
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("object cell contains no visible pixels")
    image = image.crop(bounds)
    target = int(size * occupancy)
    scale = min(target / image.width, target / image.height)
    image = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - image.width) // 2
    y = size - image.height - round(size * (1 - occupancy) / 2)
    canvas.alpha_composite(image, (x, y))
    return canvas.filter(ImageFilter.UnsharpMask(radius=1.0, percent=140, threshold=3))


def object_kit(source: Path, output_dir: Path) -> None:
    sheet = Image.open(source).convert("RGBA")
    cell_width = sheet.width // 3
    cells = [
        sheet.crop((index * cell_width, 0, sheet.width if index == 2 else (index + 1) * cell_width, sheet.height))
        for index in range(3)
    ]
    fit_object(cells[0], 384, 0.92).save(output_dir / "premium_solid.png", optimize=True)
    fit_object(cells[1], 384, 0.88).save(output_dir / "premium_destructible.png", optimize=True)
    fit_object(cells[2], 512, 0.94).save(output_dir / "premium_shrine.png", optimize=True)


if __name__ == "__main__":
    for map_id, (floor_source, object_source) in KITS.items():
        output_dir = MAPS / map_id
        output_dir.mkdir(parents=True, exist_ok=True)
        floor_plate(SOURCE / floor_source, output_dir / "premium_floor_plate.webp")
        object_kit(SOURCE / object_source, output_dir)
