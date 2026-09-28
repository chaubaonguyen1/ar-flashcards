"""Generate AR.js pattern markers for the flashcards.

For each card this writes
  apps/web/public/markers/<id>.patt  ARToolKit pattern file (what the tracker matches)
  apps/web/public/markers/<id>.png   printable marker (black border + inner symbol)

The .patt encoding mirrors AR.js's marker generator (THREEx.ArPatternFile):
the inner image is sampled at 16x16, for 4 orientations (0, 90, 180, 270 deg
counter-clockwise), each written as B, G, R planes of 16 rows.

Run `python tools/make_markers.py --check` to validate the encoder against the
official Hiro marker shipped with AR.js.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "apps" / "web" / "public" / "markers"
DEMO_OUT = ROOT / "apps" / "web" / "public" / "demo"

# Letter on the card + a corner dot so no pattern is rotationally symmetric
# (otherwise the tracker cannot tell which way up the card is).
CARDS = {
    "apple": "A",
    "tree": "T",
    "house": "H",
    "car": "C",
    "fish": "F",
    "sun": "S",
}

MARKER_PX = 1024
PATT_RATIO = 0.5  # inner image covers the middle 50% of the marker


def encode_patt(inner: Image.Image) -> str:
    inner = inner.convert("RGB")
    blocks = []
    for ccw in (0, 90, 180, 270):
        img = inner.rotate(ccw, expand=True).resize((16, 16), Image.BILINEAR)
        px = img.load()
        lines = []
        for channel in (2, 1, 0):  # B, G, R
            for y in range(16):
                lines.append(" ".join(f"{px[x, y][channel]:3d}" for x in range(16)))
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks) + "\n"


def draw_inner(letter: str, size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), "white")
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype("arialbd.ttf", int(size * 0.78))
    box = d.textbbox((0, 0), letter, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0] + size * 0.06, (size - h) / 2 - box[1] + size * 0.04), letter, font=font, fill="black")
    r = size * 0.1
    d.ellipse((size * 0.04, size * 0.04, size * 0.04 + 2 * r, size * 0.04 + 2 * r), fill="black")
    return img


def full_marker(inner: Image.Image) -> Image.Image:
    marker = Image.new("RGB", (MARKER_PX, MARKER_PX), "black")
    inner_px = int(MARKER_PX * PATT_RATIO)
    offset = (MARKER_PX - inner_px) // 2
    marker.paste(inner.resize((inner_px, inner_px), Image.LANCZOS), (offset, offset))
    # White quiet zone so the black border stands out on any background.
    page = Image.new("RGB", (int(MARKER_PX * 1.15), int(MARKER_PX * 1.15)), "white")
    pad = (page.width - MARKER_PX) // 2
    page.paste(marker, (pad, pad))
    return page


def demo_photo(marker: Image.Image) -> Image.Image:
    """A 4:3 'photo' of the card lying on a desk, for camera-less demos.

    ARToolKit processes 4:3 frames; a square image would be stretched and the
    pose estimate distorted. A slight perspective tilt makes the 3D pop out.
    """
    w, h, side = 1600, 1200, 560
    photo = Image.new("RGB", (w, h), (214, 196, 170))
    x0, y0 = (w - side) // 2, (h - side) // 2 + 60
    corners = [(x0 + 150, y0 + 120), (x0 - 60, y0 + 520), (x0 + side + 60, y0 + 520), (x0 + side - 150, y0 + 120)]  # TL BL BR TR
    coeffs = _perspective_coeffs([(0, 0), (0, side), (side, side), (side, 0)], corners)
    card = marker.resize((side, side), Image.LANCZOS)
    warped = card.transform((w, h), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    mask = Image.new("L", (side, side), 255).transform((w, h), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    photo.paste(warped, (0, 0), mask)
    return photo


def _perspective_coeffs(src, dst):
    """Coefficients for Image.PERSPECTIVE, which maps output (dst) points back to input (src) points."""
    import numpy as np

    rows = []
    for (x, y), (u, v) in zip(src, dst):
        rows.append([u, v, 1, 0, 0, 0, -x * u, -x * v])
        rows.append([0, 0, 0, u, v, 1, -y * u, -y * v])
    b = np.array([c for p in src for c in p], dtype=float)
    return np.linalg.solve(np.array(rows, dtype=float), b).tolist()


def check_against_hiro(hiro_png: Path, hiro_patt: Path) -> None:
    img = Image.open(hiro_png).convert("L")
    bbox = img.point(lambda v: 255 if v < 128 else 0).getbbox()
    marker = img.crop(bbox)
    n = marker.width
    inner = marker.crop((n // 4, n // 4, n - n // 4, n - n // 4))
    ours = [int(v) for v in encode_patt(inner).split()]
    ref = [int(v) for v in hiro_patt.read_text().split()]
    assert len(ours) == len(ref) == 16 * 16 * 3 * 4, (len(ours), len(ref))
    mean_abs = sum(abs(a - b) for a, b in zip(ours, ref)) / len(ref)
    # Rotation order matters: compare per-orientation to catch a wrong direction.
    per_block = [
        sum(abs(a - b) for a, b in zip(ours[i * 768:(i + 1) * 768], ref[j * 768:(j + 1) * 768])) / 768
        for i in range(4)
        for j in [i]
    ]
    print(f"mean |diff| vs official patt.hiro: {mean_abs:.1f} / 255, per orientation {[round(x, 1) for x in per_block]}")
    assert mean_abs < 25, "encoder does not match AR.js pattern format"


def main() -> None:
    if "--check" in sys.argv:
        check_against_hiro(Path(sys.argv[2]), Path(sys.argv[3]))
        return
    OUT.mkdir(parents=True, exist_ok=True)
    DEMO_OUT.mkdir(parents=True, exist_ok=True)
    for card_id, letter in CARDS.items():
        inner = draw_inner(letter, 512)
        (OUT / f"{card_id}.patt").write_text(encode_patt(inner))
        marker = full_marker(inner)
        marker.save(OUT / f"{card_id}.png")
        demo_photo(marker).save(DEMO_OUT / f"{card_id}.jpg", quality=88)
        print(f"wrote {card_id}: .patt, printable .png, demo .jpg")


if __name__ == "__main__":
    main()
