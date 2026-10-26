import { CalendarDays, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { Pill } from "./Pill";

export function FloatingActions({ scan = false }: { scan?: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(scrollY > 650);
    update();
    addEventListener("scroll", update, { passive: true });
    return () => removeEventListener("scroll", update);
  }, []);
  return (
    <div
      className={"hje-floating" + (visible ? " is-visible" : "")}
      inert={!visible}
    >
      <Pill to="/contact">
        <Phone size={15} />
        Reception
      </Pill>
      <Pill to="#schedule">
        <CalendarDays size={15} />
        {scan ? "Scan slots" : "Appointment times"}
      </Pill>
    </div>
  );
}
