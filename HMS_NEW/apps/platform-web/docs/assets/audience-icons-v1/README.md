# Healthcare audience icons

Five separate assets generated with the built-in imagegen tool. The established hand-drawn clinic asset on disk was inspected as the style reference: rounded black outlines, white interiors and light blue accents.

| Icon | Website asset | Original |
| --- | --- | --- |
| Clinic | [clinic.webp](../../../public/assets/audience-icons-v1/clinic.webp) | [clinic.png](clinic.png) |
| Hospital | [hospital.webp](../../../public/assets/audience-icons-v1/hospital.webp) | [hospital.png](hospital.png) |
| Labs & diagnostics | [labs.webp](../../../public/assets/audience-icons-v1/labs.webp) | [labs.png](labs.png) |
| Dental | [dental.webp](../../../public/assets/audience-icons-v1/dental.webp) | [dental.png](dental.png) |
| Physiotherapy | [physiotherapy.webp](../../../public/assets/audience-icons-v1/physiotherapy.webp) | [physiotherapy.png](physiotherapy.png) |

The exact prompts and source output paths are in [prompts.json](prompts.json). Originals are preserved unchanged; the website uses optimized 512px WebP versions. Alpha transparency was verified on all five originals and website exports.

These small icons appear in navigation and illustrated workflow cards. The large page illustrations remain reserved for the forthcoming Claude Design assets.

Display colours: clinics retain blue; hospitals use a red hue rotation; labs use lavender. CSS filters in `src/app/product-showcase-menu.css` apply consistently to navigation and discovery cards. Original artwork files are unchanged.
