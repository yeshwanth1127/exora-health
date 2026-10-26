import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorMessage, Hint, Status } from "./ui";
import { VideoFrame, type JoinGrant } from "./Teleconsultations";
type Session = {
  status: string;
  doctorName: string;
  hospitalName: string;
  startsAt: string;
  joinOpensAt: string;
  joinClosesAt: string;
  next: string;
  retryAfterSeconds: number | null;
  consent: {
    accepted: boolean;
    document: { version: string; title: string; body: string } | null;
  };
};
// Capture only once before StrictMode replay, clear the fragment, and never persist the link token.
let token = "";
if (location.pathname === "/staff/video-consult") {
  token = new URLSearchParams(location.hash.slice(1)).get("t") ?? "";
  history.replaceState(null, "", location.pathname);
}
async function patientRequest<T>(path: string, body?: unknown) {
  const response = await fetch(`/tele/v1/session${path}`, {
    method: path ? "POST" : "GET",
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: {
      "X-Teleconsult-Token": token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error?.message ?? "The consultation could not be reached.",
    );
  return result as T;
}
export function PatientVideo() {
  const [session, setSession] = useState<Session | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [grant, setGrant] = useState<JoinGrant | null>(null),
    [device, setDevice] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        if (!token)
          throw new Error(
            "This joining link is missing or has expired. Ask the clinic for a new link.",
          );
        const value = await patientRequest<Session>("");
        if (alive) {
          setSession(value);
          setError("");
          if (value.next === "closed") setGrant(null);
          timer = setTimeout(
            load,
            Math.max(5, value.retryAfterSeconds ?? 30) * 1000,
          );
        }
      } catch (e) {
        if (alive) {
          setSession(null);
          setGrant(null);
          setError(
            e instanceof Error ? e.message : "Could not reach the clinic.",
          );
        }
      }
    }
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [version]);
  async function action(path: string, body?: unknown) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const value = await patientRequest<JoinGrant>(path, body);
      if (path === "/join") setGrant(value);
      if (path === "/leave") setGrant(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We could not confirm the action. Refresh before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-muted/30 p-6 flex justify-center">
      <Card className="w-full max-w-2xl h-fit mt-10">
        <CardContent className="pt-8 space-y-6">
          <Badge variant="outline">Paperwhale · Video consultation</Badge>
          <h1 className="text-2xl font-semibold">
            {session?.hospitalName ?? "Join your consultation"}
          </h1>
          <ErrorMessage text={error} />
          {session && (
            <>
              <p>
                {session.doctorName} ·{" "}
                {new Date(session.startsAt).toLocaleString()}
              </p>
              <Status value={session.status} />
              {session.next === "accept_consent" &&
                session.consent.document && (
                  <div className="space-y-4">
                    <h2 className="font-semibold">
                      {session.consent.document.title}
                    </h2>
                    <p className="text-sm whitespace-pre-wrap">
                      {session.consent.document.body}
                    </p>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void action("/consent", {
                          documentVersion: session.consent.document!.version,
                          accepted: true,
                        })
                      }
                    >
                      I agree to this video-consultation consent
                    </Button>
                  </div>
                )}
              {["enter_waiting_room", "wait_for_doctor", "join"].includes(
                session.next,
              ) && (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        const media = await navigator.mediaDevices.getUserMedia(
                          { audio: true, video: true },
                        );
                        media.getTracks().forEach((t) => t.stop());
                        setDevice(
                          "Camera and microphone permission granted. Connection is checked when you join.",
                        );
                      } catch {
                        setDevice(
                          "Camera or microphone is unavailable. Check browser permissions and try again.",
                        );
                      }
                    }}
                  >
                    Check camera and microphone
                  </Button>
                  {device && <p className="text-sm">{device}</p>}
                </div>
              )}
              {session.next === "enter_waiting_room" && (
                <Button
                  disabled={busy}
                  onClick={() => void action("/check-in")}
                >
                  Enter waiting room
                </Button>
              )}
              {session.next === "wait_for_doctor" && (
                <Hint>
                  You are in the waiting room. Your doctor will start the
                  consultation.
                </Hint>
              )}
              {session.next === "wait_for_start_time" && (
                <Hint>
                  The joining window opens at{" "}
                  {new Date(session.joinOpensAt).toLocaleString()}.
                </Hint>
              )}
              {session.next === "join" && (
                <Button disabled={busy} onClick={() => void action("/join")}>
                  Join / reconnect consultation
                </Button>
              )}
              {grant && <VideoFrame key={grant.expiresAt} grant={grant} />}{" "}
              {grant && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void action("/leave")}
                >
                  Leave video
                </Button>
              )}
              {session.next === "closed" && (
                <Hint>
                  This video consultation has closed. Contact the clinic if you
                  need help.
                </Hint>
              )}
              {session.next === "unavailable" && (
                <Hint>
                  The clinic has not made this consultation available yet.
                </Hint>
              )}
            </>
          )}
          <Button
            variant="ghost"
            disabled={busy || !token}
            onClick={() => setVersion((v) => v + 1)}
          >
            Refresh consultation
          </Button>
          <p className="text-xs text-muted-foreground">
            Keep this patient link private. This page does not give access to
            clinical records.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
