# Recreate this illustration family

Use the built-in ImageGen tool. `prompts.json` contains the exact full prompts
and the inputs for all six outputs. Keep the original PNGs as visual references
for follow-ups; prompts alone do not guarantee identical geometry or output.

## New scene

Use the common style wording from an original asset prompt. Replace only the
scene paragraph. Attach `references/wavefind-person-laptop-white.png` as the
style reference. Set `transparent_background: true`. Generate each scene as a
separate image. Inspect every result on the website background before adoption.

## Colour variant

Use the exact edit prompt from either colour variant, substitute the desired
colour and hex code, and attach the original asset (not just the Wavefind
reference). Preserve black linework, white fills, framing and transparency.

Current accents: lime #AACA60, sky blue #79B8EF, coral #EE927B.
These are prompt targets; actual generated pixel colours vary.

## Reference library

The supplied Goodle SVG archive contains 25 SVGs. See `reference-library.txt`.
The initial four assets used the Wavefind laptop artwork, not this new archive.

## QA

All six outputs have real PNG alpha channels; see `validation.json`.
The clinic-team original has soft translucent edge/halo treatment and a maximum
alpha of 254; keep it as an approved-looking concept candidate pending an in-page
check, rather than calling it a pristine flat cutout. The other assets have
opaque interiors. No asset has been inserted into the live page yet.
