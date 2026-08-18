"""Generate the compact comic-style dsh-whale-musume promo poster."""

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
BACKGROUND_DIR = ROOT / "output" / "promo-v4"
BACKGROUND_PATH = BACKGROUND_DIR / "image2-key-visual-background.png"
OUTPUT_PATH = OUTPUT_DIR / "promo-poster-v4.png"
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
    (232, 245, 255, 236), (245, 237, 255, 236), (255, 242, 218, 236),
    (255, 230, 239, 236), (227, 249, 242, 236), (229, 238, 255, 236),
]


def font_path(*names: str) -> str:
    for name in names:
        candidate = Path("C:/Windows/Fonts") / name
        if candidate.exists():
            return str(candidate)
    raise FileNotFoundError(names)


CHINESE_FONT = font_path("STXINWEI.TTF", "FZSTK.TTF", "STXINGKA.TTF", "simkai.ttf")
BODY_FONT = font_path("simhei.ttf", "STXIHEI.TTF", "msyh.ttc")
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
Asset type: premium anime character key visual background, wide 16:9
Primary request: an art-directed abstract deep-ocean data world for a blue whale-girl desktop mascot, with sweeping translucent wave ribbons, luminous cyan code-like particles, refracted pearl light and a few sharp coral-red accents.
Composition: strong diagonal motion from lower left to upper right; deep cobalt negative space on the left for oversized typography; a bright underwater halo on the right for one large foreground character; cinematic depth and asymmetrical editorial balance.
Style/medium: polished Japanese animation project key art, contemporary music-cover design, refined screen-print grain, subtle glass refraction, graphic but atmospheric, premium rather than childish.
Color palette: ink cobalt, electric cyan, pearl white, midnight blue, tiny coral-red accents.
Text: none.
Constraints: no characters, no faces, no mascot, no text, no letters, no logos, no watermark, no rounded cards, no grids, no speech bubbles, no UI, no clip-art decorations, no generic pastel collage."""
    client = OpenAI(api_key=key, base_url=API_BASE)
    result = client.images.generate(model=MODEL, prompt=prompt, quality="high", size="2048x1152", response_format="b64_json")
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
    bbox = image.getchannel("A").getbbox()
    return image.crop(bbox) if bbox else image


def fit_pose(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    image = alpha_crop(image)
    scale = min(max_width / image.width, max_height / image.height)
    return image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.LANCZOS)


def faded(image: Image.Image, opacity: float) -> Image.Image:
    image = image.copy().convert("RGBA")
    image.putalpha(image.getchannel("A").point(lambda value: round(value * opacity)))
    return image


def paste_shadow(canvas: Image.Image, image: Image.Image, xy: tuple[int, int], strength: float = 0.18, blur: int = 8) -> None:
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    piece = Image.new("RGBA", image.size, (47, 77, 137, 0))
    piece.putalpha(image.getchannel("A").point(lambda value: round(value * strength)))
    shadow.alpha_composite(piece, (xy[0] + 4, xy[1] + 7))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(blur)))
    canvas.alpha_composite(image, xy)


def centered(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, font: ImageFont.FreeTypeFont, fill: tuple[int, ...]) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    x = box[0] + (box[2] - box[0] - bbox[2] + bbox[0]) // 2
    y = box[1] + (box[3] - box[1] - bbox[3] + bbox[1]) // 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=fill)


def outlined(image: Image.Image, padding: int = 24) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    padded_alpha = Image.new("L", (image.width + padding * 2, image.height + padding * 2), 0)
    padded_alpha.paste(alpha, (padding, padding))
    outline_mask = padded_alpha.filter(ImageFilter.MaxFilter(31))
    result = Image.new("RGBA", padded_alpha.size, (255, 255, 255, 0))
    result.putalpha(outline_mask.point(lambda value: round(value * 0.94)))
    result.alpha_composite(image, (padding, padding))
    return result


def compose(background: Image.Image) -> None:
    canvas = ImageOps.fit(background, CANVAS_SIZE, method=Image.Resampling.LANCZOS).convert("RGBA")
    canvas.alpha_composite(Image.new("RGBA", CANVAS_SIZE, (8, 25, 67, 38)))
    draw = ImageDraw.Draw(canvas, "RGBA")

    # A ghosted duplicate makes the mascot identity part of the atmosphere without adding another subject.
    ghost = fit_pose(Image.open(ASSET_DIR / "dsh-whale-state-idle-cute.webp"), 880, 1060)
    ghost = faded(ghost.filter(ImageFilter.GaussianBlur(1.2)), 0.12)
    canvas.alpha_composite(ghost, (-120, 106))

    display_font = font_path("Lato-Heavy.ttf", "arialbd.ttf")
    whale_font = load_font(display_font, 230)
    musume_font = load_font(display_font, 178)
    draw.text((72, 112), "WHALE", font=whale_font, fill=(237, 247, 255, 224), stroke_width=1, stroke_fill=(237, 247, 255, 224))
    draw.text((76, 344), "MUSUME", font=musume_font, fill=(86, 213, 241, 232))
    draw.rectangle((78, 548, 690, 562), fill=(245, 100, 126, 238))

    small_font = load_font(display_font, 25)
    draw.text((82, 72), "DEEPSEEK HARNESS / DESKTOP MASCOT", font=small_font, fill=(182, 222, 242, 230))
    draw.text((82, 590), "DSH CHARACTER PROJECT  01", font=small_font, fill=(202, 231, 247, 218))

    tagline = "陪你写代码，也陪你摸鱼。"
    tagline_font = load_font(font_path("simhei.ttf", "STXIHEI.TTF"), 45)
    draw.text((82, 924), tagline, font=tagline_font, fill=(247, 250, 255, 242))
    draw.text((84, 990), "LOCAL DESKTOP COMPANION", font=small_font, fill=(111, 219, 237, 224))

    # Use the real project render as the only full-color subject.
    hero = fit_pose(Image.open(ASSET_DIR / "dsh-whale-state-work-idea.webp"), 930, 1080)
    hero = outlined(hero)
    hx = 1118 + (820 - hero.width) // 2
    hy = 22
    paste_shadow(canvas, hero, (hx, hy), strength=0.38, blur=20)

    # Thin editorial registration marks are intentional, not decoration clusters.
    draw.line((1904, 84, 1976, 84), fill=(247, 250, 255, 210), width=3)
    draw.line((1940, 48, 1940, 120), fill=(247, 250, 255, 210), width=3)
    draw.text((1872, 1012), "01 / 24", font=small_font, fill=(247, 250, 255, 220))
    draw.rectangle((82, 1078, 1966, 1082), fill=(177, 227, 244, 130))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUTPUT_PATH, format="PNG", optimize=True)
    print(OUTPUT_PATH)
    print(f"background={BACKGROUND_PATH}")
    print(f"size={canvas.size}")


if __name__ == "__main__":
    compose(fetch_background())
