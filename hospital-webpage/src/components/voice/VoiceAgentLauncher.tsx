import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic2, MicOff, PhoneOff, ShieldCheck, Volume2, X } from 'lucide-react';
import type { ConversationAgent, ServerTranscriptMsg } from 'sarvam-conv-ai-sdk/browser';
import { API_BASE } from '../../lib/hospitalApi';

interface VoiceAgentConfig {
  enabled: boolean;
  provider: 'sarvam';
  agent_name: string;
  org_id: string | null;
  workspace_id: string | null;
  agent_id: string | null;
  runtime_base_url: string;
}

interface TranscriptLine {
  id: number;
  role: 'user' | 'bot';
  content: string;
}

interface VoiceAgentLauncherProps {
  user?: { name: string; identifier: string } | null;
}

function browserCallerId() {
  const storageKey = 'avocado_voice_caller_id';
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const created = `web-${suffix}`;
  localStorage.setItem(storageKey, created);
  return created;
}

type VoiceState = 'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error';

const stateCopy: Record<VoiceState, string> = {
  idle: 'Ready to start',
  connecting: 'Connecting securely…',
  connected: 'Connected',
  listening: 'Listening…',
  speaking: 'Aanya is speaking…',
  error: 'Connection error',
};

function isCallActive(value: VoiceState): boolean {
  return value === 'connected' || value === 'listening' || value === 'speaking';
}

export function VoiceAgentLauncher({ user }: VoiceAgentLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<VoiceAgentConfig | null>(null);
  const [state, setState] = useState<VoiceState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const agentRef = useRef<ConversationAgent | null>(null);
  const transcriptId = useRef(0);

  const active = isCallActive(state);

  useEffect(() => {
    if (!isOpen || config) return;
    fetch(`${API_BASE}/api/v1/voice-agent/config`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Voice assistant configuration could not be loaded.');
        return response.json() as Promise<VoiceAgentConfig>;
      })
      .then(setConfig)
      .catch((reason: Error) => setError(reason.message));
  }, [config, isOpen]);

  useEffect(() => () => {
    const agent = agentRef.current;
    agentRef.current = null;
    if (agent) void agent.stop().catch(() => undefined);
  }, []);

  const endCall = async () => {
    const agent = agentRef.current;
    agentRef.current = null;
    if (agent) await agent.stop().catch(() => undefined);
    setState('idle');
    setIsMuted(false);
  };

  const close = async () => {
    await endCall();
    setIsOpen(false);
  };

  const startCall = async () => {
    if (!config?.enabled || !config.org_id || !config.workspace_id || !config.agent_id) return;
    setError('');
    setTranscript([]);
    setState('connecting');
    try {
      const { BrowserAudioInterface, ConversationAgent: SarvamConversationAgent, InteractionType } = await import('sarvam-conv-ai-sdk/browser');
      const audioInterface = new BrowserAudioInterface(16000, { outputGain: 1.15 });
      const agent = new SarvamConversationAgent({
        apiKey: '',
        platform: 'browser',
        baseUrl: `${API_BASE}${config.runtime_base_url}`,
        audioInterface,
        config: {
          org_id: config.org_id,
          workspace_id: config.workspace_id,
          app_id: config.agent_id,
          user_identifier_type: 'custom',
          user_identifier: user?.identifier || browserCallerId(),
          interaction_type: InteractionType.CALL,
          input_sample_rate: 16000,
          output_sample_rate: 16000,
          agent_variables: {
            user_name: user?.name || 'Guest',
            channel: 'avocado_website',
          },
        },
        stateCallback: (nextState) => setState(nextState as VoiceState),
        transcriptCallback: async (message: ServerTranscriptMsg) => {
          setTranscript((current) => [...current.slice(-7), {
            id: ++transcriptId.current,
            role: message.role,
            content: message.content,
          }]);
        },
        endCallback: async () => {
          agentRef.current = null;
          setState('idle');
          setIsMuted(false);
        },
      });
      agentRef.current = agent;
      await agent.start();
    } catch (reason) {
      agentRef.current = null;
      setState('error');
      const message = reason instanceof Error ? reason.message : 'The voice call could not be started.';
      if (/permission|notallowed|microphone/i.test(message)) {
        setError('Microphone access is needed. Allow microphone access in your browser and try again.');
      } else if (/503|not configured/i.test(message)) {
        setError('The Sarvam voice service needs its server key before calls can start.');
      } else {
        setError(message);
      }
    }
  };

  const toggleMute = () => {
    const agent = agentRef.current;
    if (!agent) return;
    if (agent.isMuted()) {
      agent.unmute();
      setIsMuted(false);
    } else {
      agent.mute();
      setIsMuted(true);
    }
  };

  return <>
    <button type="button" onClick={() => setIsOpen(true)}
      className="fixed bottom-24 right-5 sm:right-7 z-40 flex items-center gap-3 rounded-full bg-[#154734] text-white shadow-[0_12px_35px_rgba(21,71,52,.28)] px-4 py-3 hover:bg-[#0e3929] hover:-translate-y-0.5 transition"
      aria-label="Open voice booking assistant">
      <span className="size-9 rounded-full bg-white/12 grid place-items-center"><Mic2 className="size-5" /></span>
      <span className="text-left hidden sm:block"><span className="block text-xs text-white/65">Powered by Sarvam</span><span className="block text-sm font-semibold">Talk to Aanya</span></span>
    </button>

    {isOpen && <div className="fixed inset-0 z-[80] bg-[#0b2119]/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="voice-agent-title">
      <div className="w-full sm:max-w-md bg-[#fffdf8] rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden border border-white/70">
        <div className="bg-[#154734] text-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`size-11 rounded-full grid place-items-center ${state === 'speaking' ? 'bg-[#f2c94c] text-[#154734] animate-pulse' : 'bg-white/12'}`}>
                {state === 'speaking' ? <Volume2 className="size-5" /> : <Mic2 className="size-5" />}
              </span>
              <div><p className="text-xs text-white/65">Avocado Health voice assistant</p><h2 id="voice-agent-title" className="text-xl font-semibold">Aanya</h2></div>
            </div>
            <button type="button" onClick={() => void close()} className="size-9 grid place-items-center rounded-full hover:bg-white/10" aria-label="Close voice assistant"><X className="size-5" /></button>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-white/80">
            <span className={`size-2 rounded-full ${active ? 'bg-[#74d69a] animate-pulse' : 'bg-white/45'}`} />
            {stateCopy[state]}
          </div>
        </div>

        <div className="px-6 py-6 min-h-[330px] flex flex-col">
          {!active && transcript.length === 0 && <div className="text-center my-auto py-5">
            <div className="mx-auto size-16 rounded-full bg-[#e7f2eb] text-[#154734] grid place-items-center"><Mic2 className="size-7" /></div>
            <h3 className="mt-4 text-lg font-semibold text-[#153d30]">Book care by speaking naturally</h3>
            <p className="mt-2 text-sm leading-6 text-[#5d6c66]">Ask Aanya to find a doctor, check live availability, or book an in-person or Virtual OPD appointment.</p>
          </div>}

          {transcript.length > 0 && <div className="space-y-3 max-h-64 overflow-y-auto pr-1" aria-live="polite">
            {transcript.map((line) => <div key={line.id} className={`flex ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-5 ${line.role === 'user' ? 'bg-[#154734] text-white rounded-br-md' : 'bg-[#edf3ef] text-[#244238] rounded-bl-md'}`}>
                <span className="block text-[10px] uppercase tracking-wide opacity-60 mb-0.5">{line.role === 'user' ? 'You' : 'Aanya'}</span>{line.content}
              </div>
            </div>)}
          </div>}

          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}
          {config && !config.enabled && !error && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Sarvam is connected, but this Docker app still needs the runtime API key.</div>}

          <div className="mt-auto pt-6">
            {!active ? <button type="button" onClick={() => void startCall()} disabled={!config?.enabled || state === 'connecting'}
              className="w-full rounded-xl bg-[#154734] text-white py-3.5 font-semibold flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed hover:bg-[#0e3929] transition">
              {state === 'connecting' ? <Loader2 className="size-5 animate-spin" /> : <Mic2 className="size-5" />}
              {state === 'connecting' ? 'Connecting…' : 'Start voice call'}
            </button> : <div className="flex gap-3">
              <button type="button" onClick={toggleMute} className={`flex-1 rounded-xl border py-3 font-semibold flex items-center justify-center gap-2 ${isMuted ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-[#cfdcd5] text-[#244238] hover:bg-[#edf3ef]'}`}>
                {isMuted ? <MicOff className="size-5" /> : <Mic2 className="size-5" />}{isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button type="button" onClick={() => void endCall()} className="flex-1 rounded-xl bg-red-600 text-white py-3 font-semibold flex items-center justify-center gap-2 hover:bg-red-700"><PhoneOff className="size-5" />End call</button>
            </div>}
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#728078]"><ShieldCheck className="size-3.5" />Secure session through Sarvam Voice Agents</p>
          </div>
        </div>
      </div>
    </div>}
  </>;
}
