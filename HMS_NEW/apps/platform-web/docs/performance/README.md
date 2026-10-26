# Website media optimization — 23 October 2026

The site now serves WebP display variants for 67 referenced raster images, including brand art, illustrations, phone chrome, portraits, and onboarding artwork. Original assets remain byte-for-byte intact. SVGs remain vectors; animations are not flattened. Variants retain each source's aspect ratio and alpha, use WebP quality 82, and never upscale. The supplied `sizes` and width descriptors let the browser choose a smaller image for a small slot instead of downloading a 1000px source. Existing CSS layout, masks, object-fit and selected crops remain intact.

`SiteImage` renders a native image with responsive sources, intrinsic dimensions and async decode. Below-fold content is lazy in initial HTML, while logo/hero requests remain eager where appropriate. Saved HTML product panels also use optimized portraits. The selected Arc sources and geometry are unchanged; only the tiny sidebar avatar's application image URL changes. That avatar stays eager inside the existing lazy iframe. Unknown external images and explicit alternate-crop srcsets retain their original sources.

The display font and legacy GT America font have lossless WOFF2 copies. Character maps and glyph order match the originals. Converted font files total 784,524 bytes versus 1,939,776 bytes originally (about 60% smaller); the display face itself falls from 408,496 to 205,196 bytes. These are file-size comparisons, not a claim that both fonts download on every route.

## Evidence

- Before/after homepage fallback raster references: **2,045,420 → 487,032 bytes, 76.2% smaller** in the final build. This sums unique image fallback files in server-rendered HTML across the whole homepage; it is not initial network transfer. Native lazy loading and responsive candidate selection affect actual bytes fetched. Final results are in `http-verification.json`.
- Logo: 356,384-byte PNG → 2,428-byte 128px WebP (larger candidates remain available for higher pixel density).
- Phone frame: 392,819-byte PNG → 18,186-byte 768px WebP; the mobile candidate checked in-browser was 480px/10,756 bytes.
- All 67 source hashes are verified. Aspect ratio/transparency checks passed for a display variant of every image. Pixel comparison over white had minimum PSNR 35.3 dB; this is a technical check alongside browser visual review, not a claim of pixel-identical lossy compression.
- HTTP audit verifies initial image markup and 319 referenced local candidates across 23 routes. The SSR runtime returns `image/webp` and immutable one-year caching for content-addressed `/assets/optimized/` files. Exora's existing static host retains its existing hosting headers; the Next cache rule applies to the SSR runtime only.
- Desktop/mobile phone crop, brand mark and layout were inspected in-browser. Browser evidence is saved here. Source art, fonts and SVGs remain available for future edits. No paid Google query was run.
- Page load JS increased by about 5 KB for the responsive lookup shared by interactive components; the image reduction is much larger. No Lighthouse/Core Web Vitals or deployed CDN/network result is claimed from local checks.

## Regeneration

Run `npm run media:optimize` for new source imagery. This writes `public/assets/optimized/`, the image lookup JSON and inventory. For font changes, install `fonttools[woff]` in a development Python environment and run `python scripts/compress-fonts.py`. Original files are never edited by either encoder. Build output uses the checked-in variants; production builds do not need Python or re-encode media.

Run `python3 scripts/verify-media.py --origin http://127.0.0.1:<port> --check-cache` against an SSR preview. Omit `--check-cache` for the static preview. `npm test` verifies preserved sources, generated files, responsive/crop behavior and font inventory. Exact transfer savings and LCP/INP/CLS should be measured against the deployed domain and representative mobile conditions after deployment.
