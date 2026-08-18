"""Slice generated sheets into webp assets for dsh-whale-musume (adapted from the guild pipeline)."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output" / "imagegen"
OUTPUT = ROOT / "assets" / "generated"


def cell(image, columns, rows, column, row):
    left = round(image.width * column / columns)
    right = round(image.width * (column + 1) / columns)
    top = round(image.height * row / rows)
    bottom = round(image.height * (row + 1) / rows)
    return image.crop((left, top, right, bottom))


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


def save(image, name):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT / name, "WEBP", lossless=True, quality=90, method=6)


def grid_items(name, columns, rows, items, chroma="green"):
    image = Image.open(SOURCE / f"{name}.png").convert("RGBA")
    image = remove_chroma(image, chroma)
    for column, row, output_name, size, padding in items:
        save(fit(cell(image, columns, rows, column, row), size, padding), output_name)


def build_contact_sheet(names):
    cell_size = 220
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
        draw.text((x + 4, y + cell_size + 2), name, fill="#4A3428", font=font)
    contact = SOURCE / "contact-sheet-v12-p0.jpg"
    sheet_image.save(contact, "JPEG", quality=90)
    print(f"contact sheet: {contact}")


def build():
    names = [
        "dsh-whale-state-thinking.webp",
        "dsh-whale-state-tool.webp",
        "dsh-whale-state-afk.webp",
        "dsh-whale-state-react-belly.webp",
        "dsh-whale-state-react-tail.webp",
    ]
    grid_items("poses-v12-p0", 5, 1, [
        (col, 0, names[col], (512, 512), 10) for col in range(5)
    ])
    build_contact_sheet(names)
    print(f"built {len(names)} assets in {OUTPUT}")


if __name__ == "__main__":
    build()
