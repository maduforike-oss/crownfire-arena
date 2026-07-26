from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "champions"
OUT = SOURCE / "runtime"
FRAME = 160
COLS = 8
ROWS = 4

CHAMPIONS = {
    "dragon": "dragon_blood_heir.png",
    "wolf": "wolfbound_ranger.png",
    "frost": "frostborn_warden.png",
    "veil": "veil_witch.png",
    "skin": "skinchanger_rogue.png",
    "stone": "stoneguard_knight.png",
    "raven": "raven_seer.png",
    "beast": "beast_tamer.png",
}

# Frame ranges: idle 0-3, walk 4-9, bomb 10-13, special 14-19,
# damaged 20-22, defeated 23-28.
WALK_PHASES = (
    (-4, 2, 4, -2, -1),
    (-2, 1, 2, 0, 0),
    (1, -1, -1, 3, 1),
    (4, -2, -4, 2, 0),
    (2, 0, -2, 1, -1),
    (-1, 3, 1, -1, 1),
)


def solid_source(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise RuntimeError(f"{path.name} contains no visible art")
    image = image.crop(bounds)
    scale = min(138 / image.width, 138 / image.height)
    image = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )

    alpha = image.getchannel("A")
    alpha = alpha.point(lambda value: 255 if value >= 22 else max(0, round(value * 11.6)))
    image.putalpha(alpha)

    outline_mask = alpha.filter(ImageFilter.MaxFilter(5))
    outline_mask = ImageChops.subtract(outline_mask, alpha)
    outlined = Image.new("RGBA", image.size, (8, 8, 13, 0))
    outlined.putalpha(outline_mask)
    outlined.alpha_composite(image)
    return outlined


def anchor(image: Image.Image, x_shift: int = 0, y_shift: int = 0) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    x = (FRAME - image.width) // 2 + x_shift
    y = 148 - image.height + y_shift
    frame.alpha_composite(image, (x, y))
    return frame


def transform(image: Image.Image, angle: float = 0, sx: float = 1, sy: float = 1) -> Image.Image:
    resized = image.resize(
        (max(1, round(image.width * sx)), max(1, round(image.height * sy))),
        Image.Resampling.BICUBIC,
    )
    if angle:
        resized = resized.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    return resized


def masked_layer(base: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    crop = base.crop(box)
    layer.alpha_composite(crop, (box[0], box[1]))
    return layer


def walk_frame(base: Image.Image, phase: tuple[int, int, int, int, int]) -> Image.Image:
    left_x, left_y, right_x, right_y, upper_y = phase
    split_y = 100
    mid_x = FRAME // 2
    upper = masked_layer(base, (0, 0, FRAME, split_y + 9))
    lower_left = masked_layer(base, (0, split_y, mid_x + 8, FRAME))
    lower_right = masked_layer(base, (mid_x - 8, split_y, FRAME, FRAME))
    frame = Image.new("RGBA", base.size, (0, 0, 0, 0))
    frame.alpha_composite(lower_left, (left_x, left_y))
    frame.alpha_composite(lower_right, (right_x, right_y))
    frame.alpha_composite(upper, ((left_x + right_x) // 5, upper_y))
    return frame


def state_frames(subject: Image.Image) -> list[Image.Image]:
    base = anchor(subject)
    frames: list[Image.Image] = []

    for y, sx in ((0, 1.0), (-1, 1.006), (-2, 1.012), (-1, 1.006)):
        frames.append(anchor(transform(subject, sx=sx, sy=1.0), y_shift=y))

    frames.extend(walk_frame(base, phase) for phase in WALK_PHASES)

    for angle, sx, sy, x, y in (
        (0, 1.0, 1.0, 0, 0),
        (-4, 1.03, 0.94, -2, 5),
        (4, 1.08, 0.88, 3, 9),
        (0, 1.0, 1.0, 0, 0),
    ):
        frames.append(anchor(transform(subject, angle, sx, sy), x, y))

    for angle, sx, sy, x, y in (
        (-5, 1.02, 0.98, -3, 0),
        (-9, 1.06, 0.96, -5, -2),
        (0, 1.12, 1.03, 0, -7),
        (9, 1.08, 0.97, 5, -3),
        (4, 1.04, 0.99, 3, -1),
        (0, 1.0, 1.0, 0, 0),
    ):
        frames.append(anchor(transform(subject, angle, sx, sy), x, y))

    for angle, sx, sy, x, y in (
        (-8, 0.98, 0.98, -7, 2),
        (7, 1.03, 0.95, 7, 5),
        (0, 1.0, 1.0, 0, 0),
    ):
        frames.append(anchor(transform(subject, angle, sx, sy), x, y))

    for angle, sx, sy, x, y in (
        (0, 1.0, 1.0, 0, 0),
        (12, 1.0, 0.98, 5, 5),
        (24, 1.0, 0.94, 10, 12),
        (39, 0.98, 0.88, 14, 22),
        (55, 0.94, 0.78, 17, 34),
        (70, 0.9, 0.68, 19, 47),
    ):
        frames.append(anchor(transform(subject, angle, sx, sy), x, y))

    if len(frames) != 29:
        raise AssertionError(f"expected 29 frames, produced {len(frames)}")
    return frames


def save_atlas(champion: str, frames: list[Image.Image]) -> None:
    atlas = Image.new("RGBA", (FRAME * COLS, FRAME * ROWS), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        x = (index % COLS) * FRAME
        y = (index // COLS) * FRAME
        atlas.alpha_composite(frame, (x, y))
    atlas.save(OUT / f"{champion}_animation.webp", "WEBP", lossless=True, method=6)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for champion, filename in CHAMPIONS.items():
        save_atlas(champion, state_frames(solid_source(SOURCE / filename)))
