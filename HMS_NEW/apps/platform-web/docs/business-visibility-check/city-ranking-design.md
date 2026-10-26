# City visibility — design concept

Preview route: `/demo/local-rank`. The report remains a public-presence readiness checklist. The city grid is a separate design exploration with illustrative values, not live ranking analytics.

## Presentation

The supplied honeycomb reference becomes a geographic search grid over a quiet street/river illustration. Lime means positions 1–3, lavender 4–10 and purple 11–20. Pale dots mean not sampled; they do not imply zero visibility. Each numbered hex selects a search location, and the adjacent detail shows that point's rank and number of organic results above the clinic. The clinic's own location is marked by a dark dot. A keyword selector demonstrates how the result changes for different searches. Keyboard users can select with Enter/Space and move between adjacent cells with arrows.

The streets, scale, positions and values are illustrative. The live report does not contain these values. No paid search, ranking scan, API quota or provider settings were changed for this concept.

## Future data contract

A live result needs a query, city boundary/center, search-point coordinates, radius, language, device, observation time, provider, depth checked and target place ID. Match the target's place ID against organic results at each point. The number of results above the target is its observed organic position minus one; that count does not claim how many clinics outrank it everywhere in the city. Exclude ads and nonmatching result types from that interpretation. If absent from the checked results, say “Not found in the top N” and retain that distinct state; do not invent a position or infer that the business is missing from Maps.

Google describes local ranking as depending on relevance, distance and prominence: https://support.google.com/business/answer/7091 . The Places Text Search endpoint is a discovery API, not proof of the clinic's consumer Maps ranking: https://developers.google.com/maps/documentation/places/web-service/text-search . A provider offering query-and-coordinate Maps SERP observations can support this design, for example https://docs.dataforseo.com/v3/serp/google/maps/live/advanced/ . Provider selection, terms, costs and an actual integration remain future work, as requested by the user. A small 3×3 pilot would require nine observations per keyword per scan; the present concept's denser illustration is not a promise of that scan at the existing Google budget.
