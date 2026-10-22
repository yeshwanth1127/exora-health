/** Product-only artwork, generated independently from the on-disk doodle references. */
export default function ProductArtwork({ name, label }: { name: "ai-reception" | "whatsapp-outreach" | "google-business" | "clinic-analytics"; label: string }) {
  return <span className="capture-art capture-product-spot" role="img" aria-label={label}>
    <img loading="lazy" decoding="async" src={`/assets/capture-product-art/${name}.webp`} alt="" width="1254" height="1254" data-product-art={name} />
  </span>;
}
