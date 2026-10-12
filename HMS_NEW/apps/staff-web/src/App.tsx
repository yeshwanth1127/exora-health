import { useEffect, useState, type ComponentProps } from "react";
import {
  LayoutDashboard,
  Headphones,
  MessageCircle,
  Globe,
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
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { HmsError, request, setIdentity, setTenant } from "@/hms/client";
import { devLoginEnabled, finishLogin, oidc } from "@/hms/auth";
import { can, permittedFacilities, practitionersFor } from "@/hms/model";
import { WorkspaceContext } from "@/hms/hooks";
import { confirmLeave } from "@/hms/leave";
import { Choice, Empty, ErrorMessage, Hint } from "@/hms/ui";
import { Input } from "@/components/ui/input";
import { Patients } from "@/hms/Patients";
import {
  AppointmentWorkspace,
  ActivityWorkspace,
} from "@/hms/WorkflowWorkspace";
import { Doctors } from "@/hms/Doctors";
import { PendingModule } from "@/hms/PendingModule";
import { WhatsApp } from "@/hms/WhatsApp";
import { Voice } from "@/hms/Voice";
import { Growth } from "@/hms/Growth";
import { SettingsPage } from "@/hms/Settings";
import {
  ConsentDocuments,
  ModuleSwitches,
  Registrations,
} from "@/hms/AdminPanels";
import { Schedules } from "@/hms/Schedules";
import { Overview } from "@/hms/Overview";
import { Catalogue } from "@/hms/Catalogue";
import { Consultations } from "@/hms/Consultations";
import { Teleconsultations } from "@/hms/Teleconsultations";
import { PatientVideo } from "@/hms/PatientVideo";
import type { Facility, Me, Practitioner } from "@/hms/types";

const navigation = [
  {
    key: "overview",
    name: "Overview",
    icon: LayoutDashboard,
    permission: "appointments.read",
  },
  {
    key: "appointments",
    name: "Appointments",
    icon: CalendarDays,
    permission: "appointments.read",
  },
  {
    key: "patients",
    name: "Patients",
    icon: Users,
    permission: "patients.read",
  },
  {
    key: "consultations",
    name: "Consultations",
    icon: Stethoscope,
    permission: "encounters.read",
  },
  {
    key: "teleconsultations",
    name: "Teleconsultations",
    icon: Video,
    permission: "teleconsult.read",
  },
  {
    key: "whatsapp",
    name: "WhatsApp",
    icon: MessageCircle,
    permission: "comms.read",
  },
  {
    key: "voice",
    name: "Voice",
    icon: Headphones,
    permission: "voice.read",
  },
  {
    key: "catalogue",
    name: "Hospital catalogue",
    icon: Building2,
    permission: "catalog.read",
  },
  {
    key: "doctors",
    name: "Doctors",
    icon: Building2,
    permission: "catalog.read",
  },
  {
    key: "schedules",
    name: "Schedules",
    icon: Clock3,
    permission: "appointments.read",
  },
];
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
        <div className="text-xs text-muted-foreground mt-0.5">
          Clinic workspace
        </div>
      </div>
    </div>
  );
}
function NavigationButton({
  onClick,
  ...props
}: ComponentProps<typeof SidebarMenuButton>) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuButton
      {...props}
      onClick={(e) => {
        setOpenMobile(false);
        onClick?.(e);
      }}
    />
  );
}

export default function App() {
  return location.pathname === "/staff/video-consult" ? (
    <PatientVideo />
  ) : (
    <StaffApp />
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
  function go(next: string) {
    if (!confirmLeave()) return;
    history.pushState(null, "", `/staff/${next}`);
    if (next.split("?")[0] === page) setNavVersion((n) => n + 1);
    setPage(next.split("?")[0]);
  }
  function signout() {
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
    setIdentity(tokenValue, tenant);
    setToken(tokenValue);
    setMe(null);
    setFacilities([]);
    setFacilityId("");
    try {
      const identity = await request<Me>("/v1/me");
      if (identity.isSystemAccount)
        throw new Error("Integration accounts cannot use the staff workspace.");
      const result = await request<{ items: Facility[] }>("/v1/facilities");
      const allowed = permittedFacilities(identity, result.items);
      setTenantOptions([]);
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
    const pop = () => {
      setPage(location.pathname.split("/")[2] || "appointments");
      setNavVersion((n) => n + 1);
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
          history.replaceState(null, "", "/staff/appointments");
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
                <p className="text-sm text-muted-foreground mt-2">
                  Sign in to your clinic workspace.
                </p>
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
        <Hint>No clinic is available for your permissions.</Hint>
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
    ...(can(me, "growth.read", facilityId)
      ? ["google_business", "growth_analytics"]
      : []),
    "loyalty",
  ];
  const allowed =
    extraPages.includes(page) || visible.some((n) => n.key === page);
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader className="px-5 py-6">
            <Brand />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>CLINIC OPERATIONS</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible
                    .filter((n) => !["catalogue", "doctors"].includes(n.key))
                    .map((n) => (
                      <SidebarMenuItem key={n.key}>
                        <NavigationButton
                          isActive={
                            page === n.key ||
                            (n.key === "appointments" &&
                              ["waitlist", "queue"].includes(page))
                          }
                          onClick={() => go(n.key)}
                        >
                          <n.icon />
                          <span>{n.name}</span>
                        </NavigationButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>PATIENT GROWTH</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {[
                    {
                      key: "google_business",
                      name: "Google Business",
                      icon: Globe,
                    },
                    {
                      key: "growth_analytics",
                      name: "Growth analytics",
                      icon: ChartNoAxesCombined,
                    },
                    { key: "loyalty", name: "Loyalty program", icon: Ticket },
                  ]
                    .filter(
                      (n) =>
                        n.key === "loyalty" ||
                        can(me, "growth.read", facilityId),
                    )
                    .map((n) => (
                      <SidebarMenuItem key={n.key}>
                        <NavigationButton
                          isActive={page === n.key}
                          onClick={() => go(n.key)}
                        >
                          <n.icon />
                          <span>{n.name}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {n.key === "loyalty" ? "Concept" : ""}
                          </span>
                        </NavigationButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup className="mt-auto">
              <SidebarGroupLabel>WORKSPACE</SidebarGroupLabel>
              <SidebarMenu>
                {visible
                  .filter((n) => ["catalogue", "doctors"].includes(n.key))
                  .map((n) => (
                    <SidebarMenuItem key={n.key}>
                      <NavigationButton
                        isActive={page === n.key}
                        onClick={() => go(n.key)}
                      >
                        <n.icon />
                        <span>{n.name}</span>
                      </NavigationButton>
                    </SidebarMenuItem>
                  ))}
                <SidebarMenuItem>
                  <NavigationButton
                    isActive={page === "settings"}
                    onClick={() => go("settings")}
                  >
                    <Settings2 />
                    Workspace settings
                  </NavigationButton>
                </SidebarMenuItem>
                {auditor && (
                  <SidebarMenuItem>
                    <NavigationButton
                      isActive={page === "activity" || page === "operations"}
                      onClick={() => go("activity")}
                    >
                      <ScrollText />
                      Activity
                    </NavigationButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <div className="flex items-center gap-3 px-2 mb-2">
              <div className="size-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                {me.displayName
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <p className="text-xs font-medium">{me.displayName}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {me.staffType === "admin"
                    ? can(me, "tenant.manage")
                      ? "Clinic administrator"
                      : "Clinic staff"
                    : me.staffType.replaceAll("_", " ")}
                </p>
              </div>
            </div>
            <NavigationButton
              onClick={() => {
                if (confirmLeave()) signout();
              }}
            >
              <LogOut />
              Sign out
            </NavigationButton>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-w-0">
          <header className="workspace-header">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
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
              <div className="w-52 max-w-[55vw]">
                <Choice
                  label="Clinic"
                  value={facilityId}
                  options={facilities.map((f) => ({
                    value: f.facilityId,
                    label: f.name,
                  }))}
                  onChange={(id) => {
                    if (confirmLeave()) {
                      setTenant(me.tenantId);
                      setFacilityId(id);
                    }
                  }}
                />
              </div>
              {devLoginEnabled && (
                <Badge variant="outline">Local preview</Badge>
              )}
            </div>
          </header>
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
        </SidebarInset>
      </SidebarProvider>
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
  const [subject, setSubject] = useState("ravi"),
    [email, setEmail] = useState("");
  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <Badge variant="outline">Local development only</Badge>
        <p className="text-sm text-muted-foreground">
          Use a seeded staff identity in the isolated preview.
        </p>
        <Choice
          label="Staff identity"
          value={subject}
          onChange={setSubject}
          options={[
            { value: "ravi", label: "Ravi · Front desk" },
            { value: "asha", label: "Dr Asha · Doctor" },
            { value: "meena", label: "Meena · Nurse" },
            { value: "priya", label: "Priya · Administrator" },
          ]}
        />
        <Button
          className="w-full"
          disabled={busy}
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
          <span className="block text-xs text-muted-foreground">
            Signs in as a new identity whose email the provider has verified.
          </span>
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
function Directory({
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
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]),
    [error, setError] = useState(""),
    [reloads, setReloads] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void request<{ items: Practitioner[] }>(
      `/v1/practitioners?facilityId=${facility.facilityId}`,
      { signal: controller.signal },
    )
      .then((r) =>
        setPractitioners(practitionersFor(r.items, facility.facilityId)),
      )
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [facility.facilityId, reloads]);
  return (
    <WorkspaceContext.Provider
      value={{
        me,
        facility,
        practitioners,
        go,
        reloadPractitioners: () => setReloads((n) => n + 1),
      }}
    >
      <main className="workspace-content flex-1">
        <ErrorMessage text={error} />
        {!allowed ? (
          <Empty>This page is not available for your clinic permissions.</Empty>
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
        ) : page === "google_business" || page === "growth_analytics" ? (
          <Growth key={page} module={page} />
        ) : page === "loyalty" ? (
          <PendingModule key={page} page={page} />
        ) : (
          <Settings me={me} />
        )}
      </main>
    </WorkspaceContext.Provider>
  );
}
function Settings({ me }: { me: Me }) {
  return (
    <div className="space-y-6">
      <SettingsPage />
      <ModuleSwitches />
      <Registrations />
      <ConsentDocuments />
      <Card>
        <CardContent className="pt-6 space-y-2">
          <p className="text-sm font-medium">Your access</p>
          {Object.entries(me.permissions).map(([permission, scopes]) => (
            <div
              key={permission}
              className="flex justify-between border-b py-2 text-xs gap-4"
            >
              <span>{permission}</span>
              <span className="text-muted-foreground">
                {scopes.includes("*")
                  ? "All clinics"
                  : `${scopes.length} clinic(s)`}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
