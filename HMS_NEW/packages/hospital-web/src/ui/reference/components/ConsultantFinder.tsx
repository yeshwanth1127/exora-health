import { ArrowRight, ChevronDown, Search } from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import { useWebsite } from "../../Runtime";
import { Nav } from "../shared";
import { A } from "./A";
import { Pill } from "./Pill";

export function ConsultantFinder({ params }: { params: URLSearchParams }) {
  const { doctors, services, treatments, demoEnabled, catalogError } =
    useWebsite();
  const specialtyName = (id: string) =>
    services.find((s) => s.id === id)?.name || id;
  const go = useContext(Nav),
    root = useRef<HTMLDivElement>(null);
  const initialService = params.get("service") || "";
  const match =
    services.find((s) => s.id === initialService) ||
    treatments.find((t) => t.id === initialService);
  const [query, setQuery] = useState(match?.name || ""),
    [service, setService] = useState(initialService),
    [name, setName] = useState(
      params.get("consultant_name") || params.get("q") || "",
    ),
    [age, setAge] = useState(params.get("sees") || ""),
    [suggest, setSuggest] = useState(false),
    [active, setActive] = useState(-1);
  const options = [
    ...services.map((s) => ({
      id: s.id,
      label: s.name + " clinic",
      specialty: s.id,
    })),
    ...treatments.map((t) => ({
      id: t.id,
      label: t.name,
      specialty: t.specialty,
    })),
  ].filter(
    (s) => query.trim() && s.label.toLowerCase().includes(query.toLowerCase()),
  );
  const specialty =
    services.find((s) => s.id === initialService)?.id ||
    treatments.find((t) => t.id === initialService)?.specialty ||
    "";
  const searched = [...params.keys()].some(
    (key) => !["template", "name"].includes(key),
  );
  const results = doctors.filter(
    (d) =>
      (!specialty || d.specialty === specialty) &&
      ((!params.get("consultant_name") && !params.get("q")) ||
        d.name
          .toLowerCase()
          .includes(
            (
              params.get("consultant_name") ||
              params.get("q") ||
              ""
            ).toLowerCase(),
          )) &&
      (!demoEnabled ||
        !params.get("sees") ||
        (params.get("sees") === "paediatric"
          ? d.specialty === "paediatrics"
          : d.specialty !== "paediatrics")),
  );
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node))
        setSuggest(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const choose = (option: (typeof options)[number]) => {
    setService(option.id);
    setQuery(option.label);
    setSuggest(false);
    setActive(-1);
  };
  const submit = () => {
    const exact = options.find(
      (o) => o.label.toLowerCase() === query.toLowerCase(),
    );
    const params = new URLSearchParams({
      service: service || exact?.id || "",
      consultant_name: name,
      sees: age,
    });
    if (!service && !exact && query) params.set("consultant_name", query);
    go("/consultants?" + params.toString());
  };
  return (
    <div className="hje-finder hje-container">
      {catalogError && (
        <div role="alert">
          <p>{catalogError}</p>
          <button onClick={() => location.reload()}>
            Reload published doctors
          </button>
        </div>
      )}
      <div className="hje-center-intro">
        <h1>Consultant Finder</h1>
        <p>
          {demoEnabled
            ? "Explore the example care team, choose a specialty or treatment and find a consultant."
            : "Explore our published care team, choose a specialty or treatment and find a consultant."}{" "}
          Review their profile and available appointment slots.
        </p>
      </div>
      <form
        className="hje-finder-filters"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="hje-autocomplete" ref={root}>
          <label htmlFor="consultant-care-search">
            Search by treatment or specialty
          </label>
          <input
            id="consultant-care-search"
            role="combobox"
            aria-expanded={suggest && options.length > 0}
            aria-controls="care-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={
              active >= 0 ? "care-option-" + active : undefined
            }
            autoComplete="off"
            placeholder="Start typing here..."
            value={query}
            onFocus={() => setSuggest(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setService("");
              setActive(-1);
              setSuggest(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSuggest(false);
                setActive(-1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSuggest(true);
                setActive((a) => Math.min(a + 1, options.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (
                e.key === "Enter" &&
                suggest &&
                active >= 0 &&
                options[active]
              ) {
                e.preventDefault();
                choose(options[active]);
              }
            }}
          />
          {suggest && options.length > 0 && (
            <ul
              className="hje-suggestions"
              id="care-suggestions"
              role="listbox"
              aria-label="Treatments and specialties"
            >
              {options.map((o, i) => (
                <li
                  key={o.id}
                  role="option"
                  aria-selected={active === i}
                  id={"care-option-" + i}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                >
                  {o.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <label>
          Name
          <input
            placeholder="e.g., Rao"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {demoEnabled && (
          <label>
            Consultant treats
            <span className="hje-native-select">
              <select value={age} onChange={(e) => setAge(e.target.value)}>
                <option value="">Adults & Children</option>
                <option value="adult">Adults</option>
                <option value="paediatric">Children</option>
              </select>
              <ChevronDown size={18} aria-hidden="true" />
            </span>
          </label>
        )}
        <button className="hje-pill" type="submit">
          Search Consultants
        </button>
      </form>
      {!searched ? (
        <div className="hje-quick-specialties">
          <h2>Or choose from one of the options below</h2>
          <div>
            {services.map((s) => (
              <Pill key={s.id} to={"/consultants?service=" + s.id} outline>
                {s.name}
              </Pill>
            ))}
          </div>
          <Pill to="/consultants?service=&consultant_name=&sees=">
            See all consultants <ArrowRight size={16} />
          </Pill>
        </div>
      ) : (
        <>
          <div className="hje-results-heading">
            <p>
              {results.length}{" "}
              {results.length === 1 ? "consultant" : "consultants"} found
              {demoEnabled ? " · Example profiles" : ""}
            </p>
            <A to="/consultants">Clear search</A>
          </div>
          {results.length ? (
            <div className="hje-finder-results">
              {results.map((d) => (
                <article className="hje-result-card" key={d.id}>
                  <A
                    className="hje-result-person"
                    to={"/consultants/" + d.id}
                    aria-label={"View " + d.name}
                  >
                    <span className="hje-avatar" aria-hidden="true">
                      {d.initials}
                    </span>
                    <span>
                      <strong>{d.name}</strong>
                      <small>Consultant · {specialtyName(d.specialty)}</small>
                    </span>
                  </A>
                  <div className="hje-result-actions">
                    <p>Appointments available for:</p>
                    <span className="hje-age-tag">
                      {demoEnabled
                        ? d.specialty === "paediatrics"
                          ? "Children"
                          : "Adult"
                        : "Contact hospital for age eligibility"}
                    </span>
                    <div>
                      <Pill outline to={"/consultants/" + d.id}>
                        View Profile
                      </Pill>
                      <Pill to={"/consultants/" + d.id + "#schedule"}>
                        View available slots
                      </Pill>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="hje-no-results">
              <Search size={28} />
              <h2>No consultants match your search</h2>
              <p>Try a different name, specialty or age group.</p>
              <Pill to="/consultants">Clear search</Pill>
            </div>
          )}
        </>
      )}
    </div>
  );
}
