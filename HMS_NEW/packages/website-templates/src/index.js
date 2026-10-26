/** Public template metadata. No tenant data, provider configuration or secrets. */
export const websiteTemplates = Object.freeze(
  [
    {
      id: "standard",
      name: "Standard clinic website",
      index: 0,
      engine: "standard",
    },
    {
      id: "sri-lakshmi",
      name: "Sri Lakshmi hospital website",
      index: 1,
      engine: "sri-lakshmi",
    },
    {
      id: "hospital-editorial",
      name: "Editorial hospital website",
      index: 2,
      engine: "editorial",
    },
    {
      id: "swastikaa",
      name: "Swastikaa template",
      index: 3,
      engine: "hospital",
    },
    {
      id: "hospital-pathway",
      name: "Pathway hospital template",
      index: 4,
      engine: "hospital",
      reference: "https://www.spirehealthcare.com/",
      preview: "/templates/pathway.png",
    },
    {
      id: "hospital-atlas",
      name: "Atlas hospital template",
      index: 5,
      engine: "hospital",
      reference: "https://www.hcahealthcare.co.uk/",
      preview: "/templates/atlas.png",
    },
    {
      id: "hospital-grove",
      name: "Grove hospital template",
      index: 6,
      engine: "hospital",
      reference: "https://www.cromwellhospital.com/",
      preview: "/templates/grove.png",
    },
  ].map(Object.freeze),
);
export const websiteTemplateIds = Object.freeze(
  websiteTemplates.map((t) => t.id),
);
export const hospitalTemplateIds = Object.freeze(
  websiteTemplates.filter((t) => t.engine === "hospital").map((t) => t.id),
);
export const isHospitalTemplate = (id) => hospitalTemplateIds.includes(id);
export const isWebsiteTemplate = (id) => websiteTemplateIds.includes(id);
