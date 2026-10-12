import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useWorkspace } from "./hooks";
import { query } from "./client";
import { today } from "./model";
import { upcomingPatientAppointments } from "./booking-workflow";
import type { Appointment, EncounterRow } from "./types";

export function usePatientAppointments(patientId?: string | null) {
  const { me, facility, can } = useWorkspace();
  const enabled = !!patientId && can("appointments.read");
  const from = today(facility.timezone);
  const key = `${me.tenantId}:${me.staffId}:${facility.facilityId}:${patientId}:${from}:${enabled}`;
  const [state, setState] = useState<{
    key: string;
    data: Appointment[] | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  const reload = useRef<(() => Promise<Appointment[] | null>) | null>(null);
  useEffect(() => {
    if (!enabled || !patientId) {
      reload.current = null;
      return;
    }
    let alive = true,
      sequence = 0;
    let controller: AbortController;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const current = ++sequence;
      controller?.abort();
      clearTimeout(timer);
      controller = new AbortController();
      try {
        const data = await upcomingPatientAppointments(
          facility.facilityId,
          patientId,
          from,
          controller.signal,
        );
        if (alive && current === sequence) {
          setState({ key, data, error: "" });
          return data;
        }
      } catch (e) {
        if (
          alive &&
          current === sequence &&
          !(e instanceof Error && e.name === "AbortError")
        )
          setState({
            key,
            data: null,
            error:
              e instanceof Error
                ? e.message
                : "Existing appointments could not be checked.",
          });
      } finally {
        if (
          alive &&
          current === sequence &&
          document.visibilityState === "visible"
        )
          timer = setTimeout(() => void load(), 15000);
      }
      return null;
    };
    const visible = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") void load();
    };
    reload.current = load;
    void load();
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      controller?.abort();
      clearTimeout(timer);
      reload.current = null;
      document.removeEventListener("visibilitychange", visible);
    };
  }, [key, enabled, patientId, facility.facilityId, from]);
  return {
    enabled,
    data: enabled && state.key === key ? state.data : null,
    error: enabled && state.key === key ? state.error : "",
    loading: enabled && (state.key !== key || (!state.data && !state.error)),
    refresh: useCallback(async () => (await reload.current?.()) ?? null, []),
  };
}

export function useTodayVisits(patientId?: string | null) {
  const { facility, can } = useWorkspace();
  const result = useQuery<{ items: EncounterRow[] }>(
    patientId && can("encounters.read")
      ? `/v1/encounters?${query({ facilityId: facility.facilityId, date: today(facility.timezone) })}`
      : null,
    5000,
  );
  return {
    ...result,
    items: result.data?.items.filter((v) => v.patientId === patientId) ?? [],
  };
}
