import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LayoutDashboard,
  Headphones,
  ChartNoAxesCombined,
  ScrollText,
  Ticket,
  ChevronRight,
  Building2,
  CalendarDays,
  Clock3,
  HeartPulse,
  LogOut,
  Settings2,
  Stethoscope,
  Users,
  UserRound,
  Video,
} from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModePicker } from "@/components/ModePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArcSidebarLayout, type SidebarSection } from "@/components/arc/sidebar/sidebar";
import { HmsError, request, setIdentity, setTenant } from "@/hms/client";
import { devLoginEnabled, finishLogin, oidc } from "@/hms/auth";
import { can, permittedFacilities, practitionersFor } from "@/hms/model";
import { WorkspaceContext, useQuery } from "@/hms/hooks";
import { hasUnsavedChanges, requestLeave, leaveState } from "@/hms/leave";
import { useRecoverableCommand } from "@/hms/operational-command";
import { RecoveryNotice } from "@/hms/OperationalRecovery";
import { useUnsaved } from "@/hms/leave";
import { LeaveDialog } from "@/hms/LeaveDialog";
import { Choice, Empty, ErrorMessage, Field, Hint, LoadingState } from "@/hms/ui";
import { Input } from "@/components/ui/input";
import { Patients } from "@/hms/Patients";
import {
  AppointmentWorkspace,
  ActivityWorkspace,
} from "@/hms/WorkflowWorkspace";
import { Doctors } from "@/hms/Doctors";
import { WhatsApp } from "@/hms/WhatsApp";
import { Voice } from "@/hms/Voice";
import { GoogleBusiness } from "@/hms/GoogleBusiness";
import { WebsiteAnalytics } from "@/hms/WebsiteAnalytics";
import { SettingsPage } from "@/hms/Settings";
import { Schedules } from "@/hms/Schedules";
import { Overview } from "@/hms/Overview";
import { Catalogue } from "@/hms/Catalogue";
import { Consultations } from "@/hms/Consultations";
import { Teleconsultations } from "@/hms/Teleconsultations";
import { Loyalty } from "@/hms/Loyalty";
import { PatientVideo } from "@/hms/PatientVideo";
import type { Facility, Me, Practitioner } from "@/hms/types";

const navigation = [
  { group: "Clinic", key: "overview", name: "Overview", icon: LayoutDashboard, permission: "appointments.read" },
  { group: "Clinic", key: "appointments", name: "Appointments", icon: CalendarDays, permission: "appointments.read" },
  { group: "Clinic", key: "schedules", name: "Schedules", icon: Clock3, permission: "appointments.read" },
  { group: "Clinic", key: "patients", name: "Patients", icon: Users, permission: "patients.read" },
  { group: "Care", key: "consultations", name: "Consultations", icon: Stethoscope, permission: "encounters.read" },
  { group: "Care", key: "teleconsultations", name: "Teleconsultations", icon: Video, permission: "teleconsult.read" },
  { group: "Messages", key: "whatsapp", name: "WhatsApp", icon: WhatsAppIcon, permission: "comms.read" },
  { group: "Messages", key: "voice", name: "Voice", icon: Headphones, permission: "voice.read" },
  { group: "Growth", key: "google_business", name: "Google Business", icon: GoogleIcon, permission: "growth.read" },
  { group: "Growth", key: "growth_analytics", name: "Website analytics", icon: ChartNoAxesCombined, permission: "growth.read" },
  // Reception checks membership at the desk, so anyone who sees appointments sees loyalty.
  { group: "Growth", key: "loyalty", name: "Loyalty programs", icon: Ticket, permission: "appointments.read" },
  { group: "Workspace", key: "catalogue", name: "Hospital catalogue", icon: Building2, permission: "catalog.read" },
  { group: "Workspace", key: "doctors", name: "Doctors", icon: UserRound, permission: "catalog.read" },
];
const groups = ["Clinic", "Care", "Messages", "Growth"];
function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="brand-icon">
        <HeartPulse className="size-5" />
      </div>
      <div>
        <div className="font-semibold tracking-tight text-[15px]">
          Exora Health
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return location.pathname === "/staff/video-consult" ? (
    <PatientVideo />
  ) : (
    <>
      <LeaveDialog />
      <StaffApp />
    </>
  );
}
function StaffApp() {
  const [me, setMe] = useState<Me | null>(null),
    [facilities, setFacilities] = useState<Facility[]>([]),
    [facilityId, setFacilityId] = useState("");
  const [tenantOptions, setTenantOptions] = useState<
      { tenantId: string; name: string }[]
    >([]),
    [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [page, setPage] = useState(
    () => location.pathname.split("/")[2] || "appointments",
  );
  const [navVersion, setNavVersion] = useState(0);
  const route = useRef({
    url: location.pathname + location.search + location.hash,
    index: 0,
  });
  const historyDecision = useRef<{
    target: string;
    index: number;
    phase: "restoring" | "accepting";
  } | null>(null);
  const [listedClinics, setListedClinics] = useState(0);
  const [bootstrap, setBootstrap] = useState<{ state: string; canCreateClinic: boolean; organizationProvisioned: boolean } | null>(null);
  function go(next: string, onNavigated?: () => void) {
    requestLeave(() => {
      const index = route.current.index + 1;
      history.pushState({ hmsIndex: index }, "", `/staff/${next}`);
      route.current = {
        url: location.pathname + location.search + location.hash,
        index,
      };
      if (next.split("?")[0] === page) setNavVersion((n) => n + 1);
      setPage(next.split("?")[0]);
      onNavigated?.();
    });
  }
  function signout() {
    leaveState.stay();
    historyDecision.current = null;
    setIdentity("");
    setToken("");
    setMe(null);
    setFacilities([]);
    setFacilityId("");
    setTenantOptions([]);
    void oidc?.removeUser();
  }
  async function accept(tokenValue: string, tenant = "") {
    setBusy(true);
    setError("");
    leaveState.stay();
    historyDecision.current = null;
    setIdentity(tokenValue, tenant);
    setToken(tokenValue);
    setMe(null);
    setFacilities([]);
    setFacilityId("");
    try {
      const identity = await request<Me>("/v1/me");
      if (identity.isSystemAccount)
        throw new Error("Integration accounts cannot use the staff workspace.");
      const context = await request<{ facilities: Facility[]; bootstrap: { state: string; canCreateClinic: boolean; organizationProvisioned: boolean } }>("/v1/session-context");
      setBootstrap(context.bootstrap);
      const result = { items: context.facilities };
      const allowed = permittedFacilities(identity, result.items);
      setTenantOptions([]);
      setListedClinics(context.bootstrap.state === "inaccessible_clinics" ? 1 : result.items.length);
      setFacilities(allowed);
      setFacilityId(allowed[0]?.facilityId ?? "");
      setMe(identity);
    } catch (e) {
      if (e instanceof HmsError && Array.isArray(e.details.tenants)) {
        // Hospital names come with the choice (G02); fall back to the id for any without one.
        const names = new Map(
          (
            (e.details.tenantNames as
              { tenantId: string; name: string }[] | undefined) ?? []
          ).map((t) => [t.tenantId, t.name]),
        );
        setTenantOptions(
          (e.details.tenants as string[]).map((id) => ({
            tenantId: id,
            name: names.get(id) ?? id,
          })),
        );
      } else setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    history.replaceState({ ...history.state, hmsIndex: 0 }, "", location.href);
    const renderRoute = () => {
      route.current = {
        url: location.pathname + location.search + location.hash,
        index: history.state?.hmsIndex ?? route.current.index,
      };
      setPage(location.pathname.split("/")[2] || "appointments");
      setNavVersion((n) => n + 1);
    };
    const pop = () => {
      const pending = historyDecision.current;
      if (pending?.phase === "restoring") {
        if (history.state?.hmsIndex !== route.current.index) {
          // Another Back/Forward arrived before restoration. Keep the task mounted.
          const index = history.state?.hmsIndex;
          if (Number.isInteger(index)) history.go(route.current.index - index);
          else
            history.replaceState(
              { hmsIndex: route.current.index },
              "",
              route.current.url,
            );
          return;
        }
        historyDecision.current = null;
        requestLeave(() => {
          historyDecision.current = { ...pending, phase: "accepting" };
          history.go(pending.index - route.current.index);
        });
        return;
      }
      if (pending?.phase === "accepting") {
        if (history.state?.hmsIndex !== pending.index) {
          const index = history.state?.hmsIndex;
          if (Number.isInteger(index)) history.go(pending.index - index);
          return;
        }
        historyDecision.current = null;
        renderRoute();
        return;
      }
      const target = location.pathname + location.search + location.hash;
      const index = history.state?.hmsIndex;
      if (
        hasUnsavedChanges() &&
        (target !== route.current.url || index !== route.current.index)
      ) {
        if (Number.isInteger(index) && index !== route.current.index) {
          historyDecision.current = { target, index, phase: "restoring" };
          history.go(route.current.index - index);
        } else {
          // Legacy entries lack an index. Restore the current task before asking.
          history.replaceState(
            { hmsIndex: route.current.index },
            "",
            route.current.url,
          );
          requestLeave(() => {
            history.replaceState({ hmsIndex: route.current.index }, "", target);
            renderRoute();
          });
        }
        return;
      }
      renderRoute();
    };
    const end = () => signout();
    window.addEventListener("popstate", pop);
    window.addEventListener("hms-signout", end);
    oidc?.events.addAccessTokenExpired(end);
    if (location.pathname === "/staff/callback") {
      setBusy(true);
      void finishLogin()
        .then((user) => {
          if (!alive) return;
          history.replaceState({ hmsIndex: 0 }, "", "/staff/appointments");
          route.current = { url: "/staff/appointments", index: 0 };
          setPage("appointments");
          return accept(user.access_token);
        })
        .catch((e) => {
          setError(e.message);
          setBusy(false);
        });
    }
    return () => {
      alive = false;
      window.removeEventListener("popstate", pop);
      window.removeEventListener("hms-signout", end);
      oidc?.events.removeAccessTokenExpired(end);
    };
  }, []);
  if (!me)
    return (
      <TooltipProvider>
        <div className="login-layout">
          <aside className="login-story">
            <Brand />
            <div>
              <Badge
                variant="secondary"
                className="bg-white/10 text-white border-white/10"
              >
                YOUR CLINIC, CONNECTED
              </Badge>
              <h1>
                A clearer day
                <br />
                for your team.
              </h1>
              <p>
                Appointments, patient arrivals and consultations.
                <br />
                One workspace for your clinic.
              </p>
            </div>
            <p className="text-sm opacity-70">Exora Health · Staff workspace</p>
          </aside>
          <main className="login-panel">
            <div className="login-form space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">Welcome back</h2>
              </div>
              <ErrorMessage text={error} />
              {tenantOptions.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm">Choose your hospital account.</p>
                  {tenantOptions.map((t) => (
                    <Button
                      key={t.tenantId}
                      variant="outline"
                      className="w-full"
                      disabled={busy}
                      onClick={() => void accept(token, t.tenantId)}
                    >
                      {t.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <>
                  {oidc && (
                    <Button
                      className="w-full"
                      disabled={busy}
                      onClick={() =>
                        void oidc
                          ?.signinRedirect()
                          .catch((e) => setError(e.message))
                      }
                    >
                      Continue with single sign-on
                    </Button>
                  )}
                  {devLoginEnabled ? (
                    <DevSignIn
                      busy={busy}
                      onLogin={async (subject, email) => {
                        setBusy(true);
                        setError("");
                        try {
                          const result = await request<{ token: string }>(
                            "/dev/login",
                            {
                              method: "POST",
                              body: { subject, ...(email ? { email } : {}) },
                            },
                          );
                          await accept(result.token);
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : "Sign-in failed.",
                          );
                          setBusy(false);
                        }
                      }}
                    />
                  ) : (
                    !oidc && (
                      <Hint>
                        Single sign-on has not been configured for this
                        workspace. Contact your administrator.
                      </Hint>
                    )
                  )}
                </>
              )}
              {busy && (
                <p role="status" className="text-sm text-muted-foreground">
                  Opening your workspace…
                </p>
              )}
            </div>
          </main>
        </div>
      </TooltipProvider>
    );
  const facility = facilities.find((f) => f.facilityId === facilityId);
  if (!facility)
    return (
      <div className="p-8 space-y-4">
        <Brand />
        <h1 className="text-xl font-semibold">
          {listedClinics
            ? "You don’t have clinic access yet"
            : "Your clinic workspace needs provisioning"}
        </h1>
        <Hint>
          {listedClinics
            ? "Ask your clinic administrator to assign access, then refresh your account."
            : "No clinic was returned for this account. First-clinic creation needs a verified organization setup permission; contact your organization administrator."}
        </Hint>
        {bootstrap?.state === "zero_clinics" && bootstrap.canCreateClinic && (
          <FirstClinic onCreated={() => accept(token, me.tenantId)} />
        )}
        <Button onClick={() => void accept(token, me.tenantId)} disabled={busy}>
          Refresh access
        </Button>
        <Button variant="outline" onClick={signout}>
          Sign out
        </Button>
      </div>
    );
  const visible = navigation.filter((n) => can(me, n.permission, facilityId));
  // The activity log spans every clinic, so the grant must too (the API enforces the same).
  const auditor = (me.permissions["audit.read"] ?? []).includes("*");
  const extraPages = [
    "settings",
    ...(auditor ? ["activity"] : []),
    ...(can(me, "appointments.read", facilityId) ? ["waitlist", "queue"] : []),
    ...(auditor && can(me, "appointments.read", facilityId)
      ? ["operations"]
      : []),
  ];
  const allowed =
    extraPages.includes(page) || visible.some((n) => n.key === page);
  const sidebarSections: SidebarSection[] = [...groups, "Workspace"]
    .map((group) => ({
      id: group.toLowerCase(),
      heading: group,
      items: visible
        .filter((item) => item.group === group)
        .map((item) => ({
          id: item.key === "appointments" ? "appointment-group" : item.key,
          label: item.name,
          icon: item.icon,
          ...(item.key === "appointments"
            ? {
                children: [
                  { id: "appointments", label: "All appointments" },
                  { id: "waitlist", label: "Waitlist" },
                  { id: "queue", label: "Queue" },
                ],
              }
            : {}),
        })),
    }))
    .filter((section) => section.items.length > 0);
  return (
    <TooltipProvider>
      <ArcSidebarLayout
        key={`${me.tenantId}:${me.staffId}`}
        sections={sidebarSections}
        footer={[
          { id: "settings", label: "Workspace settings", icon: Settings2 },
          ...(auditor
            ? [{ id: "activity", label: "Activity", icon: ScrollText }]
            : []),
          { id: "signout", label: "Sign out", icon: LogOut },
        ]}
        active={page === "operations" ? "activity" : page}
        brand={{
          name: "Exora Health",
          detail: facility.name,
          icon: <HeartPulse />,
        }}
        person={{
          name: me.displayName,
          role:
            me.staffType === "admin"
              ? can(me, "tenant.manage")
                ? "Clinic administrator"
                : "Clinic staff"
              : me.staffType.replaceAll("_", " "),
        }}
        onNavigate={(target, accepted) => {
          if (target === "signout")
            requestLeave(() => {
              accepted();
              signout();
            });
          else go(target, accepted);
        }}
        renderHeader={(toggle) => (
          <header className="workspace-header">
            <div className="flex items-center gap-3">
              {toggle}
              <span className="text-sm text-muted-foreground hidden md:block">
                Clinic workspace
              </span>
              <ChevronRight className="size-3 text-muted-foreground hidden md:block" />
              <span className="text-xs font-medium hidden md:block">
                {(["appointments", "waitlist", "queue"].includes(page)
                  ? "Appointments"
                  : ["activity", "operations"].includes(page)
                    ? "Activity"
                    : navigation.find((n) => n.key === page)?.name) ??
                  (page === "settings"
                    ? "Workspace settings"
                    : page === "activity"
                      ? "Activity log"
                      : page.replaceAll("_", " "))}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ModePicker />
              <div className="w-52 max-w-[55vw]">
                <Choice
                  label="Clinic"
                  value={facilityId}
                  options={facilities.map((f) => ({
                    value: f.facilityId,
                    label: f.name,
                  }))}
                  onChange={(id) => {
                    requestLeave(() => {
                      setTenant(me.tenantId);
                      setFacilityId(id);
                    });
                  }}
                />
              </div>
              {devLoginEnabled && (
                <Badge variant="outline">Local preview</Badge>
              )}
            </div>
          </header>
        )}
      >
        <Directory
          key={`${me.tenantId}:${facilityId}:${navVersion}`}
          me={me}
          facility={facility}
          page={page}
          allowed={allowed}
          go={go}
        />
        <footer className="workspace-footer">
          <span>Exora Health · {facility.name}</span>
          <span>{facility.timezone}</span>
        </footer>
      </ArcSidebarLayout>
      <Toaster />
    </TooltipProvider>
  );
}
function DevSignIn({
  busy,
  onLogin,
}: {
  busy: boolean;
  onLogin: (subject: string, email?: string) => Promise<void>;
}) {
  const configuredSubject = import.meta.env.VITE_HMS_DEV_SUBJECT?.trim() || "";
  const [subject, setSubject] = useState(configuredSubject || "ravi"),
    [email, setEmail] = useState(""),
    [customIdentity,setCustomIdentity]=useState(Boolean(configuredSubject));
  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <Badge variant="outline">Local development only</Badge>
        {customIdentity ? <label htmlFor="dev-subject" className="block space-y-1.5 text-sm"><span className="font-medium">Registered staff identity</span><Input id="dev-subject" value={subject} onChange={e=>setSubject(e.target.value)} autoComplete="off" /></label> : <Choice
          label="Staff identity"
          value={subject}
          onChange={setSubject}
          options={[
            { value: "ravi", label: "Ravi · Front desk" },
            { value: "asha", label: "Dr Asha · Doctor" },
            { value: "meena", label: "Meena · Nurse" },
            { value: "priya", label: "Priya · Administrator" },
          ]}
        />}
        {!configuredSubject && <Button variant="outline" size="sm" onClick={()=>{setCustomIdentity(!customIdentity);setSubject(customIdentity?'ravi':'');}}>{customIdentity?'Use the original development identities':'Use another registered identity'}</Button>}
        <Button
          className="w-full"
          disabled={busy || !subject.trim()}
          onClick={() => void onLogin(subject)}
        >
          Open workspace
        </Button>
        <label htmlFor="dev-email" className="block space-y-1.5 text-sm">
          <span className="font-medium">Or an invited work email</span>
          <Input
            id="dev-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
          />
        </label>
        <Button
          variant="outline"
          className="w-full"
          disabled={busy || !email.includes("@")}
          onClick={() => void onLogin(`invite:${email.toLowerCase()}`, email)}
        >
          Sign in with email
        </Button>
      </CardContent>
    </Card>
  );
}
type DirectoryProps = {
  me: Me;
  facility: Facility;
  page: string;
  allowed: boolean;
  go: (page: string) => void;
};
function Directory(props: DirectoryProps) {
  return (
    <WorkspaceContext.Provider
      value={{
        me: props.me,
        facility: props.facility,
        practitioners: [],
        go: props.go,
      }}
    >
      <DirectoryContent {...props} />
    </WorkspaceContext.Provider>
  );
}
function DirectoryContent({
  me,
  facility,
  page,
  allowed,
  go,
}: {
  me: Me;
  facility: Facility;
  page: string;
  allowed: boolean;
  go: (page: string) => void;
}) {
  const canReadDoctors = can(me, "catalog.read", facility.facilityId);
  const doctors = useQuery<{ items: Practitioner[] }>(
    canReadDoctors
      ? `/v1/practitioners?facilityId=${facility.facilityId}`
      : null,
  );
  const practitioners = useMemo(
    () => practitionersFor(doctors.data?.items ?? [], facility.facilityId),
    [doctors.data, facility.facilityId],
  );
  const needsDoctors = [
    "appointments",
    "waitlist",
    "queue",
    "schedules",
    "doctors",
  ].includes(page);
  const directoryBlocked =
    needsDoctors && (!canReadDoctors || doctors.loading || !!doctors.error);
  return (
    <WorkspaceContext.Provider
      value={{
        me,
        facility,
        practitioners,
        go,
        reloadPractitioners: () => {
          void doctors.refresh();
        },
      }}
    >
      <main className="workspace-content flex-1">
        {!allowed ? (
          <Empty>This page is not available for your clinic permissions.</Empty>
        ) : directoryBlocked ? (
          !canReadDoctors ? (
            <Hint>
              Doctor directory access is required to use this page. Ask your
              clinic administrator to review your access. Workspace settings and
              other permitted pages remain available.
            </Hint>
          ) : (
            <LoadingState {...doctors}>
              <p className="text-sm">Doctor directory</p>
            </LoadingState>
          )
        ) : page === "catalogue" ? (
          <Catalogue />
        ) : page === "operations" || page === "activity" ? (
          <ActivityWorkspace page={page} />
        ) : page === "overview" ? (
          <Overview />
        ) : ["appointments", "waitlist", "queue"].includes(page) ? (
          <AppointmentWorkspace page={page} />
        ) : page === "patients" ? (
          <Patients />
        ) : page === "consultations" ? (
          <Consultations />
        ) : page === "teleconsultations" ? (
          <Teleconsultations />
        ) : page === "schedules" ? (
          <Schedules />
        ) : page === "doctors" ? (
          <Doctors />
        ) : page === "whatsapp" ? (
          <WhatsApp />
        ) : page === "voice" ? (
          <Voice />
        ) : page === "google_business" ? (
          <GoogleBusiness />
        ) : page === "growth_analytics" ? (
          <WebsiteAnalytics />
        ) : page === "loyalty" ? (
          <Loyalty />
        ) : (
          <SettingsPage />
        )}
      </main>
    </WorkspaceContext.Provider>
  );
}

function FirstClinic({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState(""), [code, setCode] = useState(""), [stateCode, setStateCode] = useState("29");
  const command = useRecoverableCommand(request, "first-clinic");
  useUnsaved(!!name || !!code || command.busy || command.unknown);
  const create = async () => {
    if (await command.run("/v1/facilities", { name: name.trim(), code: code.trim(), stateCode, facilityType: "clinic" }, true)) await onCreated();
  };
  return <Card className="max-w-xl"><CardContent className="space-y-4 pt-6">
    <h2 className="text-lg font-semibold">Create your first clinic</h2>
    <fieldset disabled={command.busy || command.unknown} className="space-y-4">
      <Field label="Clinic name" id="bootstrap-name"><Input id="bootstrap-name" value={name} onChange={e => setName(e.target.value)} maxLength={120} /></Field>
      <Field label="Clinic code" id="bootstrap-code"><Input id="bootstrap-code" value={code} onChange={e => setCode(e.target.value)} maxLength={30} /></Field>
      <Field label="State code" id="bootstrap-state"><Input id="bootstrap-state" value={stateCode} onChange={e => setStateCode(e.target.value)} maxLength={2} /></Field>
      <Button disabled={name.trim().length < 2 || !/^[A-Za-z0-9_-]{1,30}$/.test(code.trim()) || !/^[0-9]{2}$/.test(stateCode)} onClick={() => void create()}>Create clinic</Button>
    </fieldset>
    <ErrorMessage text={command.error} />
    <RecoveryNotice command={command} onRecovered={() => void onCreated()} />
  </CardContent></Card>;
}
