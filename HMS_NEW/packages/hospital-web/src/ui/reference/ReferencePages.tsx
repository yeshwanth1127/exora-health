import { useEffect,type ReactNode } from "react";
import { useWebsite } from "../Runtime";
import { CareDetail } from "./components/CareDetail";
import { ConsultantFinder } from "./components/ConsultantFinder";
import { ConsultantProfile } from "./components/ConsultantProfile";
import { Directory } from "./components/Directory";
import { Missing } from "./components/Missing";
import { ServicePage } from "./components/ServicePage";
import { Schedule } from "./Schedule";
import { Nav } from "./shared";

export function ReferencePages({
  path,
  params,
  go,
}: {
  path: string;
  params: URLSearchParams;
  go: (to: string) => void;
}) {
  const {treatments,scans} = useWebsite();

  const parts = path.split("/").filter(Boolean);
  let page: ReactNode;
  const type = parts[0],
    id = parts[1];
  if (type === "consultants" || type === "doctors")
    page = id ? (
      <ConsultantProfile id={id} />
    ) : (
      <ConsultantFinder key={params.toString()} params={params} />
    );
  else if (["clinics", "services", "specialties", "departments"].includes(type))
    page = id ? <ServicePage id={id} /> : <Directory kind="services" />;
  else if (type === "treatments") {
    const item = treatments.find((t) => t.id === id);
    page = id ? (
      item ? (
        <CareDetail item={item} />
      ) : (
        <Missing />
      )
    ) : (
      <Directory kind="treatments" />
    );
  } else if (type === "tests-scans") {
    const item = scans.find((t) => t.id === id);
    page = id ? (
      item ? (
        <CareDetail item={item} scan />
      ) : (
        <Missing />
      )
    ) : (
      <Directory kind="scans" />
    );
  } else {
    const scan = scans.find((s) => s.id === params.get("scan"));
    page = (
      <>
        <h1 className="sr-only">Available appointments</h1>
        <Schedule
          key={params.toString()}
          doctorId={params.get("doctor") || ""}
          specialty={params.get("specialty") || ""}
          context={scan?.name || ""}
          scan={!!scan}
        />
      </>
    );
  }
  useEffect(() => {
    const hash = location.hash;
    if (hash) {
      const id = hash.slice(1);
      requestAnimationFrame(() => {
        const target = document.getElementById(id === "book" ? "schedule" : id);
        target?.scrollIntoView();
        target?.setAttribute("tabindex", "-1");
        target?.focus({ preventScroll: true });
      });
    }
  }, [path, params.toString()]);
  return (
    <Nav.Provider value={go}>
      <div className="hje-reference">{page}</div>
    </Nav.Provider>
  );
}
