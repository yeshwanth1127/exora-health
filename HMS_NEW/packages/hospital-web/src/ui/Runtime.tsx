import {
  isHospitalTemplate,
  type HospitalTemplateId,
} from "@hms/website-templates";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as demo from "./data";
import {
  services as demoServices,
  treatments as demoTreatments,
  scans as demoScans,
  type CareItem,
} from "./reference/content";
import {
  createPublicBookingApi,
  type PublicBookingApi,
  type PublicCatalog,
} from "../lib/publicBookingApi";
type Doctor = (typeof demo.doctors)[number] & {
  photoUrl?: string | null;
  acceptsVirtual?: boolean;
};
type Service = (typeof demoServices)[number];
type Profile = {
  name: string;
  city: string;
  address: string;
  phone: string;
  timezone: string;
  content: {
    logoUrl?: string;
    heroImage?: string;
    storyImage?: string;
    headline?: string;
    introduction?: string;
    story?: string;
    photos?: {
      src: string;
      title: string;
      alt: string;
      width: number;
      height: number;
    }[];
    services?: Service[];
    treatments?: CareItem[];
    scans?: CareItem[];
    insurers?: string[];
    faqs?: { q: string; a: string }[];
    packages: {
      id: string;
      name: string;
      description: string;
      priceMinor: number;
      inclusions: string[];
    }[];
  };
  runtime?: {
    template: string;
    demoEnabled: boolean;
    bookingSite: string | null;
    facilityId: string | null;
  };
};
export type WebsiteRuntime = {
  template: HospitalTemplateId;
  demoEnabled: boolean;
  bound: boolean;
  profile?: Profile;
  api?: PublicBookingApi;
  catalog?: PublicCatalog;
  catalogError?: string;
  hospital: typeof demo.hospital;
  doctors: Doctor[];
  specialties: typeof demo.specialties;
  services: Service[];
  treatments: CareItem[];
  scans: CareItem[];
  plans: typeof demo.plans;
  insurers: string[];
  faqs: typeof demo.faqs;
};
const initial: WebsiteRuntime = {
  template: "swastikaa",
  demoEnabled: true,
  bound: false,
  ...demo,
  services: demoServices,
  treatments: demoTreatments,
  scans: demoScans,
};
const Context = createContext<WebsiteRuntime>(initial);
export const useWebsite = () => useContext(Context);
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export function decodeWebsite(value: unknown): Profile {
  const d = value as Profile;
  if (
    !d ||
    typeof d.name !== "string" ||
    !d.name.trim() ||
    typeof d.city !== "string" ||
    typeof d.address !== "string" ||
    typeof d.phone !== "string" ||
    !d.content ||
    !Array.isArray(d.content.packages) ||
    !isHospitalTemplate(d.runtime?.template) ||
    typeof d.runtime.demoEnabled !== "boolean"
  )
    throw Error("The hospital website configuration could not be verified.");
  return d;
}
export function WebsiteRuntimeProvider({
  children,
  previewTemplate,
  previewName,
}: {
  children: ReactNode;
  previewTemplate?: HospitalTemplateId;
  previewName?: string;
}) {
  const config = (
    window as Window & {
      HMS_WEBSITE?: { bookingSite: string; template?: string };
    }
  ).HMS_WEBSITE;
  const query = import.meta.env.DEV
    ? new URLSearchParams(location.search)
    : null;
  const candidate = previewTemplate || query?.get("template");
  const demoTemplate = isHospitalTemplate(candidate) ? candidate : "swastikaa";
  const demoName =
    previewName || query?.get("name")?.slice(0, 120) || "Your hospital";
  const preview = {
    ...initial,
    template: demoTemplate,
    ...(demoTemplate !== "swastikaa"
      ? { hospital: { name: demoName, area: "Bengaluru" } }
      : {}),
  };
  const binding = (window as Window & { HMS_WEBSITE?: { bookingSite: string } })
    .HMS_WEBSITE?.bookingSite;
  const [state, setState] = useState<{ data?: WebsiteRuntime; error?: string }>(
    () =>
      binding
        ? {}
        : import.meta.env.DEV
          ? { data: preview }
          : { error: "This website is not bound to a hospital runtime." },
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!binding) return;
    const abort = new AbortController();
    setState({});
    void (async () => {
      try {
        const r = await fetch("/public/v1/website", {
          signal: abort.signal,
          credentials: "omit",
          cache: "no-store",
        });
        if (!r.ok) throw Error("Hospital website settings are unavailable.");
        const profile = decodeWebsite(await r.json());
        if (
          profile.runtime?.bookingSite !== binding ||
          profile.runtime?.template !== (config?.template || "swastikaa")
        )
          throw Error(
            "The hospital booking connection does not match this website.",
          );
        const api = createPublicBookingApi(binding);
        let catalog: PublicCatalog | undefined,
          catalogError: string | undefined;
        if (!profile.runtime.demoEnabled)
          try {
            catalog = await api.catalog(abort.signal);
          } catch (e) {
            if (abort.signal.aborted) return;
            catalogError =
              e instanceof Error
                ? e.message
                : "Doctor availability could not be loaded.";
          }
        const isDemo = profile.runtime.demoEnabled,
          content = profile.content;
        const services = isDemo ? demoServices : content.services || [];
        const doctors: Doctor[] = isDemo
          ? demo.doctors
          : (catalog?.doctors || []).map((d) => ({
              id: d.slug,
              name: d.name,
              initials: d.name
                .replace(/^Dr\.?\s*/i, "")
                .split(/\s+/)
                .slice(0, 2)
                .map((n) => n[0])
                .join(""),
              specialty:
                services.find(
                  (s) =>
                    s.name.toLowerCase() ===
                      (d.specialty || "").toLowerCase() ||
                    d.departments.some(
                      (n) => n.toLowerCase() === s.name.toLowerCase(),
                    ),
                )?.id || slug(d.specialty || d.departments[0] || "consultant"),
              qualifications:
                d.qualifications.join(", ") || "Qualifications not published",
              experience:
                d.experienceYears == null
                  ? "Not published"
                  : d.experienceYears + " years",
              languages: d.languages.join(", ") || "Not published",
              days: "See published availability",
              bio:
                d.bio ||
                "Contact the hospital for more information about this consultant.",
              photoUrl: d.photoUrl,
              acceptsVirtual: d.acceptsVirtual,
            }));
        const plans = isDemo
          ? demo.plans
          : content.packages.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.priceMinor / 100,
              summary: p.description,
              tests: p.inclusions,
              preparation:
                "Confirm preparation instructions with your care team.",
            }));
        if (!abort.signal.aborted)
          setState({
            data: {
              template: profile.runtime.template as HospitalTemplateId,
              demoEnabled: isDemo,
              bound: true,
              profile,
              api,
              catalog,
              catalogError,
              hospital: {
                name: profile.name,
                area:
                  profile.city || profile.address || "Location not published",
              },
              doctors,
              specialties: services,
              services,
              treatments: isDemo ? demoTreatments : content.treatments || [],
              scans: isDemo ? demoScans : content.scans || [],
              plans,
              insurers: isDemo ? demo.insurers : content.insurers || [],
              faqs: isDemo ? demo.faqs : content.faqs || [],
            },
          });
      } catch (e) {
        if (!abort.signal.aborted)
          setState({
            error:
              e instanceof Error
                ? e.message
                : "The hospital website could not be loaded.",
          });
      }
    })();
    return () => abort.abort();
  }, [binding, attempt]);
  if (state.error)
    return (
      <main className="section container">
        <h1>Hospital website unavailable</h1>
        <p role="alert">{state.error}</p>
        <button className="btn" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </main>
    );
  if (!state.data)
    return (
      <main className="section container" role="status">
        <h1>Loading hospital website</h1>
        <p>Checking the hospital’s published information…</p>
      </main>
    );
  return <Context.Provider value={state.data}>{children}</Context.Provider>;
}
