# ASCII reference — working notes (incomplete)

Reference: https://www.youtube.com/watch?v=NHTplDynnvg — downloaded MP4 supplied by the user, 1280×720, 666.133 s. This file is not part of the repository. The first pass inspected 67 images spaced ten seconds apart, followed by selected full-resolution stills, a 146-frame scene-change pass and contact sheets containing 666 frames at one-second intervals. It is **not** an exhaustive frame-by-frame analysis; conclusions and inventory below are limited to what is visible in those samples.

## Observations

- 0:00–0:15: coloured ASCII designs and enlarged details. Crosses, diagonal segments, horizontal/vertical strokes and letters appear in the art.
- 1:10–1:30: an educational comparison of dither density, then character-cell density. A dark technical frame, thin horizontal rules, square samples, small dotted corner marks and a grid around enlarged glyphs are visible. The percentages and glyph density are illustrative, not evidence of a complete fixed character set.
- Around 1:32, the animated coverage illustration depicts an `@` on an 8×8 cell, and then a period; the displayed percentage changes during the illustration, so a single screenshot is not a final coverage value. Around 1:46–1:51, horizontal, diagonal and vertical line glyphs are associated with different coverage values.
- Around 1:50–2:10: an example image is mapped to a tonal colour scale, explaining how brightness controls both glyph and colour.
- 4:10–6:30: Photoshop demonstration, multiple ASCII algorithms and edge/fill controls. Interface and mouse interaction produce changes; this does not by itself establish a glyph-scramble animation.
- Around 7:20–7:50: a comparison labelled “one glyph per band” versus “overlapping bands”; five colour swatches appear below the examples. In a magnified example characters including `i`, `Y`, `C`, `m`, `w`, `Q`, `M`, `1`, `}`, `/`, `^`, and `~` are visible. The complete set, exact cell dimensions, threshold positions and proprietary algorithm cannot be established from these frames.
- Around 7:45–8:00: closely spaced cyan/blue, magenta, orange, yellow and pale glyphs; visible edge glyphs include `-`, `|`, `/`, `\\`, `+`. Five overlapping colour bars are shown in the plugin. The screenshot is not a readable source of exact layer blend formulas.
- 8:00–9:40: changes to tonal bands/colours and output. Video also contains the host, a horse image, Photoshop UI and branded graphics; these are not generic editor shapes.

## Bundled shape approximations

The SVGs under `assets/ascii-shapes/` are small **original geometric approximations**, not extracted original vectors, not a complete video inventory, and not copies of the horse, logos or application UI. They use reusable, self-contained SVG viewBoxes and may be imported via Assets → Import ASCII shapes.

| File | Category | Visual reference | Notes |
| --- | --- | --- | --- |
| `frames/corner-marks.svg` | frames | marks at the corners of the diagrams ~1:10 | simplified strokes; the actual sample uses dotted marks |
| `frames/technical-frame.svg` | frames | framed figure, header and rules ~1:10 | simplified diagram frame |
| `frames/square-tile.svg` | frames | square density and glyph cells ~1:10–1:30 | outline |
| `grids/cell-grid.svg` | grids | enlarged glyph grid ~1:30 | regular 10×10 grid |
| `grids/dot-grid.svg` | grids | sparse density sample ~1:10 | regular dots; not an exact dither matrix |
| `decorations/tonal-bars.svg` | decorations | five colour bands beneath comparison ~7:20 | approximate colours |
| `decorations/pixel-cross.svg` | decorations | enlarged ASCII marks ~0:08 and 7:45 | geometric cross, not a font glyph |
| `decorations/pixel-diagonal.svg` | decorations | enlarged diagonal marks ~0:08 and 7:45 | simplified stepped stroke |

No shape animation can be asserted from the sampled stills. The future inventory must distinguish graphic design elements from incidental interface controls and identify timestamps, relative proportions, animation and confidence. Do not describe these original approximations as exact source vectors.

## Work in progress

The optional enhanced CPU renderer supports luma/edge output, custom/preset glyphs, source/mono/duotone/five-colour mapping, smooth/stepped/overlap approximations, gamma, thresholds, dimensions, variable density, timeline-based scramble, glow, scanlines, chromatic offset, noise and original mix. `legacy` continues to call the original renderer. The video does not establish the exact mapping for these new options.

Outstanding before release: complete the video examination/inventory to the requested scope, validate visual fidelity and exact character behaviour where actually observable, validate the optional accelerated rendering path on hardware, test mobile interactions and project round trips more thoroughly, verify SVG import in the APK, and complete the requested documentation/presets. No new version or APK should be published until the work is complete.

## Additional automated scene pass

FFmpeg decoded the source and selected **146 frames** with a scene-difference score above 0.20, including transition/camera-zoom sequences. These were inspected in contact sheets in addition to the regular ten-second sample and selected full-resolution frames. Detection evaluates frames automatically but does not identify every subtle UI change, does not constitute individual human/visual inspection of each frame, and cannot prove a complete shape inventory. For example, 0:07–0:09 is a zoom into the same ASCII artwork; 0:13–0:18 shows repeated colour glyph/edge details and zoom; 2:18–2:23 transitions through the horse example; 7:17–7:30 shows the overlapping-band comparison.

Additional standalone approximations: `frames/dotted-corners.svg` and `frames/parallel-header.svg` correspond to the figure marks/header; `icons/angle-brackets.svg` and `icons/diagonal-hatch.svg` to the enlarged angular glyph motifs; `patterns/checker.svg`, `patterns/halftone-dots.svg`, `patterns/cross-grid.svg`, and `patterns/ascii-lines.svg` to repeated sample textures. Their proportions and paths are reconstructed, not original SVG data. The figures and artwork do not reveal the underlying original vectors, exact characters or settings.

## Usage and example configurations

1. Existing ASCII projects retain their pre-existing renderer and transparent-glyph output. New nodes default to **Background → Keep original**: glyphs are composited over the input while preserving its alpha. To use this on an existing node, select **Keep original**; select **Transparent** for glyph-only output.
2. For a five-colour look: select **Luminance**, **Tonal gradient**, then **Five bands** or **Overlapping bands**. Adjust the five colours, cell size, aspect, gamma and threshold. These options are approximations, not the source plug-in's precise thresholds.
3. For angular contours: select **Edges**, adjust **Edge strength** and **Edge mode fill**, then choose the colour mapping. Slash, backslash, vertical and horizontal glyphs indicate locally estimated direction.
4. For motion: increase **Animated scramble** and move the editor timeline. Noise is deterministic per cell; timeline scramble updates when the timeline changes and does not run a separate timer.
5. For retro treatments, increase **Glow**, **Scanlines**, **Chromatic aberration**, or **Noise**. Set **Mix with original** to blend with the source.
6. Select **Assets → Import ASCII shapes**, then use **Add** on an imported SVG. The import uses bundled offline files; importing the same named shapes again into the same folder skips duplicates. The APK build copies the assets directory, but this exact flow has not yet been verified on an actual Android device.

**Enhanced preset** offers Tonal gradient, Circuit edges, and Retro display starting points. The settings remain editable.

**Enhanced renderer → GPU** is an optional WebGL atlas path for luminance, standard colour mapping, and smooth/stepped bands. It uses four source samples per cell, so it is not pixel-identical to the CPU renderer. It falls back to CPU for edges, overlap, density, animation, glow, scanlines, chromatic aberration, noise or character sets longer than 64 glyphs. The atlas cache retains only the latest glyph set. Legacy mode always retains the old rendering path.

## Approximate shape inventory and motion

All proportions are normalized to each SVG's own viewBox. The positions below describe the reference composition, not a fixed requirement for the editor. All assets have transparent backgrounds except their marks; white strokes/fills can be recolored externally. The timeline references are observations from the sampled images, not a claim that every frame has been manually reviewed.

| Asset | Observed relative location | Approximate proportion and style | Motion evidence |
| --- | --- | --- | --- |
| `frames/corner-marks.svg` | figure corners, around 1:10 | four square corner marks, thin strokes | no independent shape animation established |
| `frames/dotted-corners.svg` | outer corners of diagrams, around 1:10–2:20 | small dot clusters, roughly 2–3% of each side | no independent motion established |
| `frames/technical-frame.svg` | surrounds explanation figures, around 1:10–2:20 | wide rectangular outline with header/foot rules | unchanged in inspected stills |
| `frames/parallel-header.svg` | along the top of explanation figures, around 1:10 | two groups of narrow, parallel horizontal rules | no independent motion established |
| `frames/square-tile.svg` | sample swatches, around 1:10–1:30 | square hairline outline | examples change as the video transitions |
| `grids/cell-grid.svg` | enlarged glyph-cell examples, around 1:30 | regular square lattice with fine lines | none established |
| `grids/dot-grid.svg` | density illustrations, around 1:10 | evenly spaced small circles | none established |
| `decorations/tonal-bars.svg` | below band comparison, around 7:20–7:30 | five aligned coloured strips and a thin white rule | comparison changes during edit; no standalone SVG animation established |
| `decorations/pixel-cross.svg` | in enlarged effect, around 0:08–0:18 | thick square-ended cross | zoom/pan of entire artwork, not proven shape morphing |
| `decorations/pixel-diagonal.svg` | in enlarged effect, around 0:08–0:18 | pixel-stepped diagonal | zoom/pan of artwork |
| `icons/angle-brackets.svg` | angular contours in glyph artwork, around 0:08–0:18 | opposing angled white strokes | no independent animation established |
| `icons/diagonal-hatch.svg` | diagonal edge marks, around 0:08–0:18 | repeated dashed diagonal strokes | zoom/pan of artwork |
| `patterns/checker.svg` | dither diagram, around 1:00 | repeated black/white squares | reference demonstrates transitions of the *whole figure* |
| `patterns/halftone-dots.svg` | density sample, around 1:10 | repeated alternating small dots | no independent animation established |
| `patterns/cross-grid.svg` | enlarged ASCII glyph field, around 0:08 and 7:45 | small repeated crosses | camera zoom of entire artwork |
| `patterns/ascii-lines.svg` | enlarged contour glyph field, around 0:08 and 7:45 | repeated short horizontal marks | camera zoom of entire artwork |

The video contains additional type, host footage, screenshots, photographic artwork, logos, colour-selection widgets and many controls from a third-party application. They are not supplied as original SVGs by the video and were not represented as exact reusable vector objects here. Different video stills cannot prove their underlying vector paths, layer hierarchy or rights.

### Additional glyph and swatch approximations

- `glyphs/at-pixel.svg` and `glyphs/period-pixel.svg`: the two pixel examples at approximately 1:32–1:36, reconstructed from the displayed 8×8 grid, not original font vectors.
- `glyphs/horizontal.svg`, `glyphs/vertical.svg`, `glyphs/slash.svg`, `glyphs/asterisk.svg`, `glyphs/hash.svg`: reusable single marks analogous to the callouts around 1:46–1:51 and the enlarged artwork around 0:08–0:18.
- `decorations/tonal-vertical.svg`: a five-stop approximation of the vertical gradient legend around 2:09–2:16.

The screenshot in the reference uses repeated examples and UI demonstrations. One-second samples cover the duration but do not resolve subsecond changes or justify claiming every source frame was individually inspected.

### Full-frame computational pass

A separate FFmpeg `scale=64:36,showinfo` pass decoded all 19,984 video frames from 0.000 to 666.100 seconds and recorded a low-resolution checksum per frame; 18,794 checksums differed from their immediate predecessor. This is a technical continuity/change scan, **not** visual inspection or shape recognition of every frame. The one-second contact sheets and 146 detected cuts remain the visual sampling basis.

### Full-resolution comparison: specific frames

- At 1:36, the final @ diagram has 34 of 64 cells illuminated (53% rounded); the period has four cells (6% rounded). The two glyph SVGs were revised to match that visible cell layout. The earlier 1:32 image shows the reveal in progress, not the completed glyph.
- At 1:48, the five sample marks are a horizontal bar, a descending stair-step diagonal, a vertical bar, an asterisk-like glyph and a hash; the slide labels them 11%, 25%, 26%, 42% and 58%. These labels describe the displayed examples, not necessarily the coverage of the independently reconstructed SVGs. `glyphs/slash.svg` was revised to use a descending stepped silhouette.
- At 1:10, the dither sample is irregular rather than a perfect checkerboard. The existing checker and dots remain generic patterns, not exact copies.
- At 2:17, an enlarged coloured glyph-like mosaic appears; `decorations/pixel-tonal-cell.svg` is a new simplified, independent reconstruction, without the background glow, noise or captions. At 2:18 multiple such blocks form a grid before the horse transition.
- At 1:55–2:07, the gradient lookup table builds up from dark to light in rows while the image changes colour. Its screenshot colours are not proof of exact numerical plugin parameters.
