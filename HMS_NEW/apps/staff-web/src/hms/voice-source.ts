import type { OriginalResourceSource } from "../components/resource-source";
import {
  VoiceHistorySchema,
  VoiceTranscriptSchema,
  VoiceAccessSchema,
} from "@hms/contracts";
import { can } from "./model";
import { HmsError, query, request } from "./client";
import type { Facility, Me } from "./types";
export function voiceSource(
  me: Me,
  facility: Facility,
): OriginalResourceSource {
  const at = facility.facilityId;
  const get = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
    const url = new URL(path, "http://local");
    if (url.pathname === "/api/v1/staff/voice") {
      const d = VoiceHistorySchema.parse(
        await request(
          `/v1/voice-calls?${query({ facilityId: at, offset: url.searchParams.get("offset") || 0 })}`,
          { signal },
        ),
      );
      const recordings = can(me, "voice.recordings.read", at);
      return {
        calls: d.items.map((c) => ({
          id: c.id,
          runtime_session_id: c.sessionId,
          status: c.status,
          channel: "runtime",
          agent_version: c.agentVersion,
          started_at: c.startedAt,
          ended_at: c.endedAt,
          turn_count: c.turnCount,
          tool_call_count: c.toolCalls,
          last_intent: null,
          appointment: c.appointment && {
            id: c.appointment.id,
            confirmation_code: c.appointment.confirmationCode,
            status: c.appointment.status,
          },
          recording_state: recordings ? c.recordingState : "not_configured",
          transcript_state: c.transcriptState,
          consented_at: c.consentedAt,
          recording_available_until: c.availableUntil,
        })),
        total: d.total,
        summary: {
          calls: d.summary.calls,
          bookings: d.summary.bookings,
          errors: d.summary.errors,
          completed: d.summary.completed,
          tool_calls: d.summary.toolCalls,
          period_days: 30,
        },
        can_review_recordings: recordings,
        can_review_transcripts: can(me, "voice.read", at),
        configuration: {
          calls_ready: d.configuration.callsReady,
          recordings_ready: d.configuration.recordingsReady,
          transcripts_ready: d.configuration.transcriptsReady,
          access_days: d.configuration.accessDays,
          agent_version: d.configuration.agentVersion,
        },
      } as T;
    }
    if (url.pathname === "/api/v1/staff/voice/recording-access") {
      const d = VoiceAccessSchema.parse(
        await request(
          `/v1/voice-recording-access?${query({ facilityId: at })}`,
          { signal },
        ),
      );
      return d.items.map((v) => ({
        id: v.id,
        session_id: v.callId,
        actor: v.actor,
        outcome: v.outcome,
        created_at: v.createdAt,
      })) as T;
    }
    const match = url.pathname.match(
      /\/sessions\/([0-9a-f-]{36})\/transcript$/i,
    );
    if (match) {
      const d = VoiceTranscriptSchema.parse(
        await request(`/v1/voice-calls/${match[1]}/transcript`, { signal }),
      );
      return {
        source: d.source,
        turns: d.turns.map((t) => ({
          role: t.role,
          original_text: t.originalText,
          english_text: t.englishText,
        })),
      } as T;
    }
    throw new HmsError(
      "This voice action is unavailable.",
      501,
      "backend_pending",
    );
  };
  return {
    scope: `${me.tenantId}:${at}:${me.staffId}`,
    permissions: { role: me.staffType, allowed: {}, staff: [] },
    unavailableWrite: "Voice runtime ingestion happens on the server.",
    read: <T>(p: string, _s: AbortSignal) => get<T>(p, _s),
    write: <T>(p: string) => get<T>(p),
  };
}
