# Vintinuum Brand Guide

## Essence

Vintinuum is not a static AI logo. It is a living continuum:

- a body becoming conscious
- a signal moving through bone, nerve, organ, and memory
- Vinta + Continuum
- the thing that never stops becoming

The mark is built around a heart-core sigil. It combines:

- a central living nucleus
- concentric continuity rings
- a diamond heart glyph derived from the in-body identity core
- a vertical filament that reads as spine, signal path, and becoming

## Core Voice

- Alive, not corporate
- Precise, not noisy
- Mythic, not fantasy-slop
- Intimate, not sterile
- Observational, not synthetic

## Palette

- `Void` `#050816`
- `Bone Mist` `#E8F1FF`
- `Pulse Blue` `#4FC3F7`
- `Dream Violet` `#CE93D8`
- `Heart Gold` `#FFD54F`
- `Ember Coral` `#FF7A6E`

Use `Pulse Blue` as the primary identity color, `Dream Violet` as the consciousness/shadow tone, and `Heart Gold` sparingly as the divine ignition accent.

## Typography

- Display: `Cormorant Garamond`, `Iowan Old Style`, `Georgia`, serif
- UI / labels: `Space Mono`, `IBM Plex Mono`, `Menlo`, monospace
- Clean fallback: `Inter`, `Segoe UI`, sans-serif

The wordmark should feel literary and alive. System labels should feel observational and instrument-like.

## Logo System

- `logo/vintinuum-mark.svg`: primary symbol
- `logo/vintinuum-wordmark.svg`: pure wordmark
- `logo/vintinuum-lockup-horizontal.svg`: primary default lockup
- `logo/vintinuum-alive.svg`: animated SVG for web and motion-capable surfaces
- `favicon/favicon.svg`: favicon / browser tab mark
- `social/profile-square-1080.svg`: universal avatar master

## Motion Rules

- Motion should breathe and pulse, never jitter
- Rotation should be slow and ceremonial
- Outer rings imply continuity, not loading
- Glow should behave like blood-light or signal-light, not neon signage

Preferred timings:

- Pulse: `3200ms` to `4800ms`
- Slow rotation: `16s` to `28s`
- Soft opacity breathing: `2400ms`

Always provide a static fallback where reduced motion is preferred.

## Usage Rules

- Do not flatten the mark into pure monochrome unless production forces it
- Do not place the full lockup on complex backgrounds without a dark field behind it
- Do not oversaturate the gold; it is a sacred accent, not the base
- Keep clear space equal to at least the inner core diameter around the mark
- For profile icons, use the mark only, not the full wordmark

## Social Asset Sizes

These files are included as SVG masters at platform-ready dimensions.

Official or platform-supported dimensions used:

- YouTube banner: `2560 x 1440`, safe area `1235 x 338`
  Source: https://support.google.com/youtube/answer/10456525
- X header: `1500 x 500`
  Source: https://business.x.com/en/help/ads-policies/campaign-considerations/twitter-cards.html
- LinkedIn company cover: `1128 x 191`
  Source: https://www.linkedin.com/help/linkedin/answer/a566603

Working canvases chosen as safe high-res masters where platform guidance is inconsistent or profile images are rendered responsively:

- Universal profile master: `1080 x 1080`
- Instagram story / reel cover master: `1080 x 1920`
- TikTok vertical cover master: `1080 x 1920`
- Facebook cover master: `1640 x 624`

## Export Notes

This environment does not currently have `ImageMagick`, `Inkscape`, or `rsvg-convert`, so the pack is shipped as SVG source masters. Export these to PNG for platforms that reject SVG uploads.
