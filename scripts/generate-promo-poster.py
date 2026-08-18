"""Generate one dsh-whale-musume promo poster from the verified pose assets."""

from __future__ import annotations

import base64
import io
import os
import urllib.request
from pathlib import Path

from openai import OpenAI
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "generated"
OUTPUT_DIR = ROOT / "docs" / "images"
BACKGROUND_DIR = ROOT / "output" / "promo-v1"
BACKGROUND_PATH = BACKGROUND_DIR / "image2-background.png"
OUTPUT_PATH = OUTPUT_DIR / "promo-poster-v1.png"

CANVAS_SIZE = (2048, 1152)
API_BASE = "https://jmrai.net/v1"
MODEL = "gpt-image-2"

POSES = [
    "idle-cute", "curious", "teasing", "wink", "greet", "bold",
    "running", "work-pat", "work-ram", "work-slack", "sweep", "cool-shades",
    "balance-low", "star", "blush", "angry", "eat", "celebrate",
    "sleep", "success", "failure", "abstract", "waiting", "night",
]

PALETTE = [
    (232, 245, 255, 242), (245, 237, 255, 242), (255, 242, 218, 242),
    (255, 230, 239, 242), (227, 249, 242, 242), (229, 238, 255, 242),
]


def font_path(*names: str) -> str:
    candidates = [Path("C:/Windows/Fonts") / name for name in names]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    raise FileNotFoundError(f"No usable font found: {names}")


CHINESE_FONT = font_path("STXINGKA.TTF", "simkai.ttf", "simfang.ttf")
BODY_FONT = font_path("simhei.ttf", "STXIHEI.TTF", "HYZhongHeiTi-197.ttf", "msyh.ttc")
EMOJI_FONT = font_path("seguiemj.ttf", "seguisym.ttf")


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def fit_font(text: str, path: str, max_size: int, max_width: int) -> ImageFont.FreeTypeFont:
    for size in range(max_size, 20, -2):
        font = load_font(path, size)
        if font.getbbox(text)[2] <= max_width:
            return font
    return load_font(path, 20)


def fetch_background() -> Image.Image:
    if BACKGROUND_PATH.exists():
        return Image.open(BACKGROUND_PATH).convert("RGBA")

    key = os.environ.get("DSH_JMRAI_API_KEY", "").strip()
    if not key:
        raise SystemExit("DSH_JMRAI_API_KEY is not set; the key is never read from a project file.")

    prompt = """Use case: ads-marketing
Asset type: cute promotional poster background for a desktop mascot plugin
Primary request: Create a polished cute Japanese chibi product-poster background with a soft ocean-and-candy theme. Build a clean wall of 24 empty rounded display tiles arranged as a precise 6-column by 4-row grid, leaving every tile empty so real character stickers can be composited later.
Scene/backdrop: pale aqua and cloud-white background, subtle underwater bubbles, tiny stars, soft wave shapes, candy-like dots, gentle paper and sticker texture.
Style/medium: flat illustrated poster background, kawaii desktop app promotion, clean pastel graphic design, crisp edges, restrained decoration.
Composition/framing: wide 16:9 landscape, generous clean header space above the tile wall, consistent tile spacing, no perspective distortion.
Lighting/mood: bright, cheerful, soft, friendly, cozy.
Color palette: whale blue, cobalt, pearl white, sky blue, blush pink, butter yellow, mint green.
Text (verbatim): none.
Constraints: empty tiles only; no characters; no faces; no logos; no letters; no numbers; no watermark; no UI screenshot; keep the tile centers quiet for later compositing.
Avoid: photorealism, dark background, busy collage, gradients that obscure the tile boundaries, extra mascots, unreadable pseudo-text."""

    client = OpenAI(api_key=key, base_url=API_BASE)
    result = client.images.generate(
        model=MODEL,
        prompt=prompt,
        quality="high",
        size="2048x1152",
        response_format="b64_json",
    )
    item = result.data[0]
    encoded = getattr(item, "b64_json", None)
    if encoded:
        raw = base64.b64decode(encoded)
    else:
        url = getattr(item, "url", None)
        if not url:
            raise RuntimeError("Image 2 returned neither b64_json nor url")
        with urllib.request.urlopen(url, timeout=120) as response:
            raw = response.read()

    BACKGROUND_DIR.mkdir(parents=True, exist_ok=True)
    BACKGROUND_PATH.write_bytes(raw)
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def alpha_crop(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    return image.crop(bbox) if bbox else image


def fit_pose(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    image = alpha_crop(image)
    scale = min(max_width / image.width, max_height / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def paste_with_shadow(canvas: Image.Image, image: Image.Image, xy: tuple[int, int], blur: int = 8) -> None:
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_piece = Image.new("RGBA", image.size, (39, 73, 145, 0))
    shadow_piece.putalpha(image.getchannel("A").point(lambda value: round(value * 0.22)))
    shadow.alpha_composite(shadow_piece, (xy[0] + 5, xy[1] + 8))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(image, xy)


def draw_centered(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, font: ImageFont.FreeTypeFont, fill: tuple[int, ...]) -> None:
    left, top, right, bottom = box
    bbox = draw.textbbox((0, 0), text, font=font)
    x = left + (right - left - (bbox[2] - bbox[0])) // 2
    y = top + (bottom - top - (bbox[3] - bbox[1])) // 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=fill)


def compose(background: Image.Image) -> None:
    canvas = ImageOps.fit(background, CANVAS_SIZE, method=Image.Resampling.LANCZOS).convert("RGBA")
    draw = ImageDraw.Draw(canvas, "RGBA")

    # Add a quiet translucent tile layer so the real poses remain readable over the AI backdrop.
    grid_x, grid_y = 54, 348
    grid_w, grid_h = 1940, 744
    gap = 12
    cell_w = (grid_w - gap * 5) // 6
    cell_h = (grid_h - gap * 3) // 4
    for index, pose in enumerate(POSES):
        col, row = index % 6, index // 6
        x = grid_x + col * (cell_w + gap)
        y = grid_y + row * (cell_h + gap)
        fill = PALETTE[index % len(PALETTE)]
        draw.rounded_rectangle((x, y, x + cell_w, y + cell_h), radius=24, fill=fill, outline=(255, 255, 255, 220), width=3)
        pose_path = ASSET_DIR / f"dsh-whale-state-{pose}.webp"
        pose_image = fit_pose(Image.open(pose_path), cell_w - 28, cell_h - 14)
        px = x + (cell_w - pose_image.width) // 2
        py = y + cell_h - pose_image.height - 7
        paste_with_shadow(canvas, pose_image, (px, py), blur=5)

    # Header card keeps the headline legible while the pose wall remains the dominant texture.
    draw.rounded_rectangle((42, 28, 1998, 316), radius=44, fill=(255, 255, 255, 218), outline=(255, 255, 255, 225), width=3)
    head = fit_pose(Image.open(ASSET_DIR / "dsh-whale-home-peek.webp"), 430, 350)
    paste_with_shadow(canvas, head, (74, 4), blur=10)

    title = "陪你写代码，也陪你摸鱼。"
    title_font = fit_font(title, CHINESE_FONT, 92, 1300)
    draw.text((486, 66), title, font=title_font, fill=(30, 74, 155, 255), stroke_width=2, stroke_fill=(255, 255, 255, 255))
    title_box = draw.textbbox((486, 66), title, font=title_font)
    emoji_font = load_font(EMOJI_FONT, 70)
    draw.text((title_box[2] + 16, 78), "🐳", font=emoji_font, fill=(31, 98, 174, 255))

    product_font = load_font(BODY_FONT, 29)
    draw.text((502, 174), "dsh-whale-musume  ·  DeepSeek Harness 桌面看板娘插件", font=product_font, fill=(83, 103, 143, 255))

    tags = ["状态联动", "触摸互动", "轻量养成", "多样形态"]
    tag_colors = [(232, 111, 150, 245), (101, 164, 220, 245), (255, 184, 77, 245), (111, 191, 158, 245)]
    tag_font = load_font(BODY_FONT, 22)
    tx = 502
    for text, color in zip(tags, tag_colors):
        bbox = draw.textbbox((0, 0), text, font=tag_font)
        width = bbox[2] - bbox[0] + 34
        draw.rounded_rectangle((tx, 224, tx + width, 270), radius=23, fill=color)
        draw_centered(draw, (tx, 224, tx + width, 270), text, tag_font, (255, 255, 255, 255))
        tx += width + 14

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUTPUT_PATH, format="PNG", optimize=True)
    print(OUTPUT_PATH)
    print(f"background={BACKGROUND_PATH}")
    print(f"size={canvas.size}")


def main() -> None:
    compose(fetch_background())


if __name__ == "__main__":
    main()
