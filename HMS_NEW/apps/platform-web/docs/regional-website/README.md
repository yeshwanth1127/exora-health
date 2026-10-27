# Regional website and mobile pass

Source: canonical ClinicSheet/web. Exora and the public deployment are unchanged.

## Country and language

Header globe and footer control open one accessible dialog. Language and pricing country are independent. Preferences are saved as SameSite=Lax cookies, Secure on HTTPS; there is no geolocation request or IP lookup. Country values are allowlisted. Normal SSR requests seed pricing from the country cookie, so initial HTML matches the selected market. Language is in the URL, with an allowlisted request header controlling the HTML lang attribute. The homepage remembers the selected language; `/?lang=en` explicitly opens the original English homepage. Country never redirects language.

Available languages: English, Hindi, Tamil, Telugu, Bengali, Indonesian, Malay, Thai, Vietnamese, French, German and Spanish. English serves India, Australia, New Zealand, USA and other English-language visitors; choosing an English-speaking country does not fork translations unnecessarily.

`src/lib/i18n/config.ts` owns supported languages and translated routes. Each non-English catalog has all 98 keys. `region-copy.json` contains only the six selector strings, avoiding delivery of all page translations to the global client component. Full catalogs are used on the server; the localized pricing component receives only its current language copy.

The 19 marketing routes have concise translated versions under `/hi`, `/ta`, `/te`, `/bn`, `/id`, `/ms`, `/th`, `/vi`, `/fr`, `/de` and `/es`. These deliberately shorter versions reuse the bell identity, existing illustrations and light-blue accent. They are not full sentence-for-sentence translations of the original extensive pages. Detailed blog articles, clinical/product specifications, full legal copy and live reach reports remain English, with explicit English links. No localized aliases are created for account, staff, backend or personal report routes. Native-speaker editorial review remains outstanding.

English and translated metadata have self-canonical URLs and reciprocal hreflang links when an approved site origin is configured. The sitemap includes translated routes only when the existing indexing gate is enabled. No domain or indexing approval has been invented. This is crawlable implementation, not evidence of live search indexing.

## Local pricing

Edit **`src/lib/regional-pricing.ts`** to add approved rates for a country. Each entry has Booking and Growth monthly/annual/setup values plus the voice monthly proposal. The country list maps each market to its currency. Number formatting uses Intl.NumberFormat and the reading language; it never performs exchange-rate conversion.

Only the existing US pilot proposals are configured. India, Australia, Southeast Asia, Europe and all other unconfigured markets show a local-pricing enquiry and no fabricated local price. Pricing cards, setup, comparison table, FAQ numbers and voice proposal follow the selected market. Selecting a country is not a claim that a connected provider is available there. Online sales and demo submission remain disconnected, as in the existing site.

## Mobile scope

- The redundant HomeEnquiries section is removed from the homepage.
- The long day/night story is omitted below 768px. GSAP and ScrollTrigger are loaded only for an eligible desktop motion viewport.
- Audience pages omit the third repeated workflow row, secondary starter cards, research benchmarks and related-workflow discovery on phones. Important product routes remain in navigation/footer.
- Solution pages omit repeated benchmarks and related-links blocks on phones.
- Mobile navigation leaves room for the globe and menu; the duplicated header CTA is omitted while hero and closing CTAs remain.
- Pricing comparison is opt-in on phones; six FAQs appear first, with the rest available on demand. No comparison features or questions are deleted.
- Blog cards use a native swipe row on the homepage. Spacing, illustration sizes and footer columns are reduced without changing protected Arc dashboard component contracts.

The independent preference controls and country pricing also restore on deliberately static exports. Exact initial HTML language/country preference rendering is verified for SSR; static hosting cannot read cookies on the server and restores them after hydration.

## Executed verification

- `npm test`: 24 passing tests, including complete locale keys, safe route selection, and no inferred local rates.
- TypeScript and SSR production build pass.
- HTTP checks: all 11 non-English pricing pages return translated SSR HTML and the matching document language; invalid/private localized paths return 404. US pricing is rendered from the server cookie; IN/AU/DE and invalid-country cookies do not leak US prices into a local offer.
- Remembered-language homepage redirect and explicit English escape were exercised. POST stays rejected before preference handling.
- Browser layout sweep: home, pricing, clinics, hospitals, labs, dental, features, help, blog, French home, German hospital, Tamil home and Thai pricing at 360, 768 and 1440px: no horizontal document overflow.
- Browser interactions: country change, US price display, Hindi and French language switching with US country retained, Australia local quote, reload persistence, selector Escape/focus return, mobile comparison show/hide and extra FAQ expansion.
- Fresh mobile navigation did not request the GSAP/ScrollTrigger chunks. Resizing to eligible desktop starts the existing story; requesting reduced motion removes the active story animation state.
- No browser errors in targeted checks. Native-speaker editorial review, every-device coverage, live deployment, local commercial approval and live indexing are not established by these checks.
