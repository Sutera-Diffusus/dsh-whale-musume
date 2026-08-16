# Whale Musume Promo Poster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one reviewable `2048 x 1152` PNG preview that presents the whale musume as a real DeepSeek Harness desktop companion.

**Architecture:** Build a deterministic fixed-size HTML/CSS composition from the current DSH QA screenshot and three transparent project WebP assets. Render it locally with Microsoft Edge headless, then verify exact dimensions, thumbnail readability, character edges, and the two-line copy constraint before showing it to the user.

**Tech Stack:** HTML, CSS, Microsoft Edge headless screenshot, PowerShell image metadata checks, Codex local image inspection.

## Global Constraints

- Preview workspace: `<ARTIFACT_DIR>`.
- Canvas: exactly `2048 x 1152` pixels.
- Main title: `我来陪你啦！`.
- Subtitle: `DeepSeek Harness 桌面看板娘插件`.
- Do not add feature rows, trust rows, version metadata, CTA text, or fabricated DSH UI copy.
- Use only the current DSH QA screenshot and original transparent WebP character assets.
- Do not use the existing `promo-poster-v1` through `v4`, their backgrounds, or their scripts.
- Do not modify or commit project code, README, old promo experiments, or generated preview files.

---

### Task 1: Build the deterministic poster source

**Files:**
- Create: `<ARTIFACT_DIR>\poster.html`
- Read: `<QA_SHOTS_DIR>\01-home-light.png`
- Read: `<STAGING_REPO>\assets\generated\dsh-whale-state-running.webp`
- Read: `<STAGING_REPO>\assets\generated\dsh-whale-home-peek.webp`
- Read: `<STAGING_REPO>\assets\generated\dsh-whale-state-pick-up.webp`

**Interfaces:**
- Consumes: local image files through `file:///D:/...` URLs.
- Produces: a self-contained fixed `2048 x 1152` visual surface at `poster.html`.

- [ ] **Step 1: Create the fixed canvas and real DSH environment**

Use a zero-margin document with a fixed `.poster` surface:

```css
html, body { margin: 0; width: 2048px; height: 1152px; overflow: hidden; }
.poster { position: relative; width: 2048px; height: 1152px; background: #f7f8fb; }
.dsh-ui { position: absolute; inset: 0; width: 2048px; height: auto; opacity: .78; }
```

The screenshot must remain recognizable as one continuous DSH workspace. Do not create screenshot cards or a collage.

- [ ] **Step 2: Add the two-line type hierarchy**

Use installed `Noto Sans SC`, zero letter spacing, and no text container:

```html
<section class="copy">
  <h1>我来陪你啦！</h1>
  <p>DeepSeek Harness 桌面看板娘插件</p>
</section>
```

Place it in the main left-side workspace whitespace, with a dark ink title and whale-blue subtitle. Keep the subtitle on one line.

- [ ] **Step 3: Add the character hierarchy**

```html
<img class="hero" src="file:///<STAGING_REPO>/assets/generated/dsh-whale-state-running.webp" alt="">
<img class="peek" src="file:///<STAGING_REPO>/assets/generated/dsh-whale-home-peek.webp" alt="">
<img class="pickup" src="file:///<STAGING_REPO>/assets/generated/dsh-whale-state-pick-up.webp" alt="">
```

The `running` pose is the only large subject at `520-600px` high. `home-peek` must sit on the real input boundary, while `pick-up` stays small and is connected with a restrained cursor trace. Apply only natural shadow and a subtle blue work glow; do not add a white sticker outline.

- [ ] **Step 4: Open the HTML directly and verify asset loading**

Run:

```powershell
& '<EDGE_EXE>' --headless=new --disable-gpu --allow-file-access-from-files --dump-dom 'file:///<ARTIFACT_DIR>/poster.html'
```

Expected: output contains `我来陪你啦！`, all three `<img>` elements, and no browser load error.

### Task 2: Export the PNG

**Files:**
- Read: `<ARTIFACT_DIR>\poster.html`
- Create: `<ARTIFACT_DIR>\poster.png`

**Interfaces:**
- Consumes: the fixed HTML poster surface.
- Produces: one exact-size PNG preview.

- [ ] **Step 1: Render with Edge at device scale 1**

Run:

```powershell
& '<EDGE_EXE>' --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=1 --window-size=2048,1152 --screenshot='<ARTIFACT_DIR>\poster.png' 'file:///<ARTIFACT_DIR>/poster.html'
```

Expected: Edge reports a successful screenshot write.

- [ ] **Step 2: Verify file dimensions**

Run:

```powershell
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile('<ARTIFACT_DIR>\poster.png')
if ($image.Width -ne 2048 -or $image.Height -ne 1152) { throw "Unexpected poster size: $($image.Width)x$($image.Height)" }
$image.Dispose()
```

Expected: exit code `0` with no exception.

### Task 3: Visual QA and one refinement pass

**Files:**
- Modify if needed: `<ARTIFACT_DIR>\poster.html`
- Regenerate: `<ARTIFACT_DIR>\poster.png`

**Interfaces:**
- Consumes: the first rendered PNG.
- Produces: the final preview shown for user feedback.

- [ ] **Step 1: Inspect the full image and thumbnail**

Use the local image viewer on `poster.png`. Confirm:

```text
first focus = whale musume + 我来陪你啦！
second focus = recognizable DeepSeek Harness workspace
only added copy = title + subtitle
running = only large character
peek and pick-up = subordinate and non-overlapping
```

- [ ] **Step 2: Check character edges and layout stability**

At 100%, confirm no obvious blur, jagged edge, white sticker border, text clipping, accidental scrollbar, or UI/character overlap that obscures the face. At 25%, confirm both copy lines remain readable.

- [ ] **Step 3: Make one focused correction if any criterion fails**

Change only positioning, scale, opacity, shadow, or type size in `poster.html`, then repeat Task 2. Do not add new text, poses, decorative backgrounds, or feature blocks.

- [ ] **Step 4: Present without committing**

Show `<ARTIFACT_DIR>\poster.png` to the user and identify it as a first visual draft. Keep both preview files outside Git until the user approves the direction.
