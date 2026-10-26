import { websiteTemplates } from "@hms/website-templates";
const descriptions: Record<string, string> = {
  "hospital-pathway":
    "A clear, service-led hospital with a framed consultation hero and a compact care index.",
  "hospital-atlas":
    "An image-led specialist hospital, with a wide hero and a rich department mosaic.",
  "hospital-grove":
    "A spacious consultant-led hospital, with a typographic masthead and practical patient pathways.",
};
export function TemplateGallery() {
  return (
    <div className="kit-template-gallery">
      <header>
        <h1>Hospital website library</h1>
        <p>
          Three compositions. Shared components, care pages and appointment
          behavior.
        </p>
      </header>
      <div>
        {websiteTemplates
          .filter(
            (t) =>
              t.id.startsWith("hospital-") && t.id !== "hospital-editorial",
          )
          .map((t) => (
            <article key={t.id}>
              <a href={"/?template=" + t.id}>
                <img src={t.preview} alt={t.name + " homepage preview"} />
                <h2>{t.name}</h2>
              </a>
              <p>{descriptions[t.id]}</p>
              <nav aria-label={t.name + " preview pages"}>
                <a href={"/?template=" + t.id}>Home</a>
                <a href={"/consultants?template=" + t.id}>Doctors</a>
                <a href={"/clinics/orthopaedics?template=" + t.id}>Service</a>
                <a
                  href={"/treatments/hip-replacement-surgery?template=" + t.id}
                >
                  Treatment
                </a>
                <a href={"/tests-scans/mri?template=" + t.id}>Scan</a>
                <a href={"/book?template=" + t.id}>Appointments</a>
              </nav>
            </article>
          ))}
      </div>
      <p>
        <a href="/__components?template=hospital-pathway">Explore the component catalog</a>
      </p>
    </div>
  );
}
