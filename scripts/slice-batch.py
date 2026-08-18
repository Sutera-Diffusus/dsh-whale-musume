"""Slice a raw batch dir into review webp + contact sheet. Usage: slice-batch.py <srcDir> <outDir>"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "output" / "imagegen" / "raw-batch3"
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "output" / "imagegen" / "review-v2"


def trim(image, threshold=8):
    alpha = image.getchannel("A").point(lambda value: 255 if value > threshold else 0)
    box = alpha.getbbox()
    if box is None:
        raise ValueError("asset has no visible pixels")
    return image.crop(box)


def chroma_distance(pixel, key):
    return ((pixel[0] - key[0]) ** 2 + (pixel[1] - key[1]) ** 2 + (pixel[2] - key[2]) ** 2) ** 0.5


def remove_chroma(image, mode="green"):
    image = image.convert("RGBA")
    pixels = image.load()
    key = (0, 255, 0) if mode == "green" else (255, 0, 255)
    full = 110
    feather = 150
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            distance = chroma_distance((red, green, blue), key)
            if distance <= full:
                pixels[x, y] = (0, 0, 0, 0)
            elif distance <= feather:
                kept_alpha = round(alpha * (feather - distance) / (feather - full))
                if mode == "green":
                    pixels[x, y] = (red, min(green, max(red, blue) + 3), blue, kept_alpha)
                else:
                    pixels[x, y] = (min(red, green + 8), green, min(blue, green + 8), kept_alpha)
    return image


def fit(image, size, padding):
    image = trim(image)
    available = (size[0] - padding * 2, size[1] - padding * 2)
    scale = min(available[0] / image.width, available[1] / image.height)
    resized = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", size)
    canvas.alpha_composite(resized, ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2))
    return canvas


def build_contact_sheet(names):
    cell_size = 300
    columns = 3
    rows = (len(names) + columns - 1) // columns
    sheet_image = Image.new("RGB", (columns * cell_size, rows * (cell_size + 22)), "#FFFFFF")
    draw = ImageDraw.Draw(sheet_image)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
    for index, name in enumerate(names):
        x = (index % columns) * cell_size
        y = (index // columns) * (cell_size + 22)
        thumb = Image.open(OUTPUT / name).convert("RGBA")
        thumb.thumbnail((cell_size - 12, cell_size - 12), Image.Resampling.LANCZOS)
        sheet_image.paste(thumb, (x + 6, y + 6), thumb)
        draw.text((x + 4, y + cell_size + 4), name, fill="#4A3428", font=font)
    contact = OUTPUT / "contact-sheet.jpg"
    sheet_image.save(contact, "JPEG", quality=92)
    print(f"contact sheet: {contact}")


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    files = sorted(SOURCE.glob("*.png"))
    built = []
    for file in files:
        try:
            image = Image.open(file).convert("RGBA")
            image = remove_chroma(image, "green")
            image = fit(image, (512, 512), 10)
            name = "dsh-whale-state-" + file.stem + ".webp"
            image.save(OUTPUT / name, "WEBP", lossless=True, quality=90, method=6)
            built.append(name)
            print(f"ok {name}")
        except Exception as exc:
            print(f"FAIL {file.name}: {exc}")
    build_contact_sheet(built)
    print(f"built {len(built)} webp into {OUTPUT}")


if __name__ == "__main__":
    build()
