"""Generate poses with the canonical base image + per-pose FACE/BODY/PROPS prompts.
Key from DSH_JMRAI_API_KEY only. Outputs raw PNGs into output/imagegen/raw-batch3."""
import base64
import json
import os
import sys
import time
import urllib.error
from pathlib import Path
from urllib import request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "imagegen" / "raw-batch3"
API = os.environ.get("DSH_IMAGE_API", "https://free.quanthatch.com/c2a/v1")
MODEL = "gpt-image-2"
BASE = ROOT / "assets" / "generated" / "dsh-whale-state-idle-cute.webp"

# (name, face, body, props)
POSES = [
    ("thinking", "eyes looking up to the side with one eyebrow raised, lips pursed to one side, thoughtful",
     "head tilted, one hand tapping her chin, tail curled into a question mark",
     "one small thought bubble above her head"),
    ("tool", "focused narrowed eyes, small determined grin, brows slightly furrowed",
     "hugging a laptop while typing, leaning forward",
     "a tiny wrench tucked under her arm"),
    ("afk", "eyes fully closed, tiny open mouth with a drool bubble, totally relaxed",
     "slumped over a desk, dozing, ears perked, tail drooping",
     "none"),
    ("react-belly", "eyes squeezed shut in laughter, wide open laughing mouth, heavy blush",
     "leaning back laughing, both hands raised in surrender",
     "none"),
    ("react-tail", "wide shocked eyes, small round open mouth, flushed cheeks",
     "startled jump, tail poofed into a spring spiral, looking back over her shoulder",
     "none"),
    ("weather-umbrella", "gentle soft smile, half-lidded relaxed eyes",
     "holding a small transparent umbrella, other hand catching raindrops",
     "one small umbrella only"),
    ("weather-rain-happy", "eyes closed in joy, big open-mouth laugh",
     "splashing in puddles, mid-jump with droplets flying",
     "none"),
    ("weather-snow", "starry sparkling eyes, delighted open smile",
     "face tilted up, cupped hands catching snowflakes, scarf fluttering",
     "a scarf only"),
    ("weather-cold", "squeezed shivering eyes, chattering teeth, pale blue cheeks",
     "hugging herself, wrapped in a scarf, tail wrapped around her body, shivering",
     "a scarf only"),
    ("weather-thunder", "eyes shut tight, mouth open in a scared wail, ears flattened",
     "crouched low covering her ears, tail poofed",
     "none"),
    ("levelup", "eyes wide with sparkle stars, huge open-mouth grin",
     "jumping with both arms raised, confetti bursting overhead",
     "none"),
    ("achievement", "beaming proud smile, eyes curved in joy",
     "holding a small medal to her chest with both hands",
     "one small medal only"),
    ("daily-done", "bright grin, one eye winking",
     "standing tall with a thumbs up, tail raised proudly",
     "a small clipboard under her arm"),
    ("react-head", "eyes squeezed shut, sheepish grin, heavy blush, ahoge popped",
     "hands on top of her head, neck scrunched, knees slightly bent",
     "none"),
    ("tail-swing", "cocky smirk, one eyebrow raised, half-lidded eyes",
     "arms akimbo, hips tilted, tail swinging into a propeller blur",
     "none"),
    ("game-happy", "starry eyes, huge open-mouth laugh",
     "mid-spin with double peace signs",
     "none"),
    ("game-think", "furrowed brows, pouting lower lip, eyes cast to the side",
     "chin resting on one hand, sitting, tail circling",
     "none"),
    ("game-cheat", "teary puppy eyes, quivering pout",
     "on her knees hugging a leg, looking up pleading",
     "none"),
    ("game-win", "triumphant sparkling grin",
     "standing on one leg lifting a small trophy high",
     "one small trophy only"),
    ("game-lose", "teary watery eyes, wobbly big frown, puffed cheeks",
     "slumped sitting, head hung, a tiny rain cloud above",
     "one tiny rain cloud above"),
    ("meme-ojisan", "deadpan flat mouth, half-lidded dull eyes, one sweat drop, unimpressed",
     "arms crossed, standing stiffly",
     "none"),
    ("meme-kyun", "heart-shaped eyes, deep blush, open-mouth flustered squeal",
     "hands clasped to her chest, leaning forward",
     "none"),
    ("meme-wakuwaku", "huge sparkling eyes, excited open grin",
     "fists clenched at chest, bouncing on her toes, burst lines behind",
     "none"),
    ("meme-doge", "side-eye glance, one eyebrow raised, knowing smirk",
     "head turned sideways, hands on hips",
     "none"),
    ("meme-smile-pain", "forced strained smile, twitching eyebrow, dull dead eyes",
     "standing stiffly with a dark aura behind",
     "none"),
    ("meme-sike", "smug smirk, chin raised, confident half-lidded eyes",
     "thumbs up, leaning back slightly",
     "none"),
    ("meme-omg", "pupils shrunk to dots, jaw dropped wide open, pale face",
     "both hands on her head, trembling",
     "none"),
    ("meme-doubt", "suspicious squinted eyes, lips pursed to one side",
     "finger tapping her chin, body leaning away",
     "none"),
    ("meme-worship", "reverent closed eyes, peaceful awed smile",
     "kneeling and bowing with arms raised in worship",
     "a few tiny sparkles around"),
    ("meme-peace", "serene closed eyes, faint peaceful smile",
     "meditating in lotus pose, floating slightly",
     "one tiny halo above"),
    ("festival-spring", "bright joyful open-mouth laugh, rosy cheeks",
     "holding a small glowing lantern, festive red outfit",
     "one small lantern only"),
    ("festival-mid-autumn", "gentle closed-eye contented smile",
     "holding a mooncake in both hands, rabbit-ear headband",
     "one mooncake only"),
    ("festival-halloween", "mischievous fanged grin, one eyebrow raised",
     "holding a tiny pumpkin basket, playful crouch",
     "one tiny pumpkin basket only"),
    ("festival-christmas", "sparkling excited eyes, rosy-cheeked smile",
     "hugging a small gift box, santa hat",
     "one small gift box only"),
    ("valentine", "bashful heavy blush, shy sideways glance, soft smile",
     "holding a heart-shaped box behind her back, toe tapping",
     "one small heart box only"),
    ("daily-picnic", "cheerful open-mouth smile",
     "sitting on a picnic blanket holding a sandwich",
     "a bento box beside her"),
    ("daily-cooking", "tongue sticking out in concentration, eyes on the pancake",
     "flipping a pancake with a frying pan, chef hat",
     "one frying pan only"),
    ("daily-fishing", "excited wide eyes, open grin",
     "reeling in a fishing rod with a tiny fish on the hook",
     "one fishing rod only"),
    ("daily-painting", "focused squinting eyes, tongue out, one paint smudge on cheek",
     "painting on a small easel with a brush and palette",
     "one brush and palette only"),
    ("daily-gaming", "intense focused eyes, gritted excited grin",
     "leaning forward holding a game controller",
     "one game controller only"),
    ("work-meeting", "confident bright smile, sharp eyes",
     "standing with a presentation pointer, pointing at a small flip chart",
     "one pointer only, no flip chart"),
    ("work-debug", "narrowed suspicious eyes, tongue out, determined",
     "crouching and chasing a tiny bug with a magnifying glass",
     "one magnifying glass only"),
    ("work-deploy", "wide nervous eyes, grimacing smile, one big sweat drop",
     "pressing a small red button on a plain stand, body leaning away",
     "one small red button only"),
    ("work-review", "serious concentrated eyes, approving thin smile",
     "sitting with reading glasses reviewing a laptop, nodding",
     "one laptop only"),
    ("work-celebrate", "ecstatic open-mouth cheer, eyes squeezed in joy",
     "jumping with both arms up, party popper in one hand",
     "one party popper only"),
]

STYLE = (
    "Flat solid chroma green #00FF00 background, no text, no watermark, no extra objects beyond the listed prop, "
    "full body with whale tail and whale ears visible, same art style."
)


def api_key():
    key = os.environ.get("DSH_JMRAI_API_KEY", "").strip()
    if not key:
        raise SystemExit("set DSH_JMRAI_API_KEY (never commit the key)")
    return key


def multipart_body(boundary, fields):
    chunks = []
    for name, value in fields.items():
        chunks.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode("utf-8"))
    image = fields["__image_bytes__"]
    chunks.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"base.webp\"\r\nContent-Type: image/webp\r\n\r\n".encode("utf-8"))
    chunks.append(image)
    chunks.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks)


def generate(name, face, body, props):
    prompt = (
        f"Same character and same art style as the input image. "
        f"CRITICAL: do NOT keep the input image's smiling face — redraw the facial expression completely: {face}. "
        f"Body pose: {body}. Props: {props}. {STYLE}"
    )
    boundary = f"----dshimg{os.urandom(6).hex()}"
    body_bytes = multipart_body(boundary, {
        "prompt": prompt,
        "model": MODEL,
        "n": "1",
        "size": "1024x1024",
        "response_format": "b64_json",
        "__image_bytes__": BASE.read_bytes(),
    })
    req = request.Request(
        f"{API}/images/edits",
        data=body_bytes,
        headers={
            "Authorization": f"Bearer {api_key()}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=600) as response:
            data = json.load(response)
    except urllib.error.HTTPError as exc:
        print(f"[gen] {name}: HTTP {exc.code} {exc.read().decode('utf-8', 'replace')[:200]}")
        return False
    except urllib.error.URLError as exc:
        print(f"[gen] {name}: {exc.reason}")
        return False
    encoded = data.get("data", [{}])[0].get("b64_json")
    if not encoded:
        print(f"[gen] {name}: no b64_json: {json.dumps(data)[:200]}")
        return False
    path = OUT / f"{name}.png"
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(base64.b64decode(encoded))
    os.replace(tmp, path)
    print(f"[gen] {name} ok ({path.stat().st_size} bytes)")
    return True


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    OUT.mkdir(parents=True, exist_ok=True)
    failed = []
    for name, face, body, props in POSES:
        if only and name != only:
            continue
        if (OUT / f"{name}.png").exists():
            print(f"skip {name} (exists)")
            continue
        print(f"generating {name} ...")
        ok = generate(name, face, body, props)
        if not ok:
            failed.append(name)
        time.sleep(1)
    print(f"done. failed: {failed if failed else 'none'}")


if __name__ == "__main__":
    main()
