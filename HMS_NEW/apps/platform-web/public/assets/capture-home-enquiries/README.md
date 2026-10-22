# Capture home enquiry portraits

Four original portraits generated independently with the built-in image generator. Style reference: the approved Capture home portrait, copied into references/. Exact prompts and transparent-background setting are in prompts.json. Original generation outputs are recorded in generation-outputs.json.

- caller-lime: woman holding a phone to her ear
- texter-coral: man typing on a phone
- enquirer-blue: older woman with glasses
- parent-lime: bearded man

The site supplies circular pastel backgrounds, channel icons and enquiry text in native HTML/CSS. No text, UI or multi-person composition is baked into these images. Portraits are decorative; the sample enquiries are illustrative and contain no patient records. Reproduce with the same style reference, exact individual prompt and transparent background setting. Keep white character interiors opaque.

Placement: src/app/components/home-enquiries.tsx, replacing the former home workflow checkbox-like strip. CTA points to /contact-sales. Mobile layout reflows to two portraits, central copy, then two portraits. No WhatsApp chat bubbles or tails.

## Denser layout revision

Home section now shows nine upright figures: the four generated portraits plus two existing home heads and three existing product characters. Four carry enquiry captions; five are portrait-only. All CSS rotations removed. Positions are staggered across the top and bottom; mobile uses six grid tracks to place all nine around the central copy. No additional generation was required for this revision.
