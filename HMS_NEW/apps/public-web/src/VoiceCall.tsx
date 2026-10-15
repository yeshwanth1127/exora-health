import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, Mic, MicOff, PhoneOff, ShieldCheck } from 'lucide-react';
import { AgentState, BrowserAudioInterface, ConversationAgent, InteractionType } from 'sarvam-conv-ai-sdk/browser';

type VoiceConfig = {
  enabled: boolean;
  org_id?: string;
  workspace_id?: string;
  app_id?: string;
  version?: number;
  agent_name?: string;
  runtime_base_url?: string;
  recording_notice?: string;
  notice_version?: string;
  session_seconds?: number;
};

export function VoiceCall({ hospitalName }: { hospitalName: string }) {
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'ended'>('idle');
  const [agentState, setAgentState] = useState(AgentState.IDLE);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const agent = useRef<ConversationAgent | null>(null);
  const audio = useRef<BrowserAudioInterface | null>(null);
  const token = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/public/v1/voice/config', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() : { enabled: false })
      .then(setConfig)
      .catch(() => setConfig({ enabled: false }));
    return () => { void stop(false); };
  }, []);

  const stop = async (showEnded = true) => {
    if (timer.current) clearTimeout(timer.current);
    const current = agent.current;
    const input = audio.current;
    agent.current = null;
    audio.current = null;
    await current?.stop().catch(() => {});
    await input?.stop().catch(() => {});
    if (token.current) {
      void fetch('/public/v1/voice/sessions/end', { method: 'POST', headers: { 'X-Voice-Session': token.current }, keepalive: true });
      token.current = '';
    }
    setMuted(false);
    if (showEnded) setStatus('ended');
  };

  const start = async () => {
    if (!config?.enabled || !consent || agent.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access requires HTTPS or localhost.');
      return;
    }
    setError('');
    setStatus('connecting');
    try {
      const response = await fetch('/public/v1/voice/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recording_consent: true, notice_version: config.notice_version }),
      });
      const session = await response.json();
      if (!response.ok) throw new Error(session?.error?.message || 'Voice calling is unavailable.');
      token.current = session.session_token;
      const input = new BrowserAudioInterface(16000);
      audio.current = input;
      const current = new ConversationAgent({
        apiKey: '',
        platform: 'browser',
        baseUrl: config.runtime_base_url,
        customHeaders: { 'X-Voice-Session': token.current },
        config: {
          org_id: config.org_id!,
          workspace_id: config.workspace_id!,
          app_id: config.app_id!,
          version: config.version,
          user_identifier_type: 'custom',
          user_identifier: session.runtime_session_id,
          interaction_type: InteractionType.CALL,
          input_sample_rate: 16000,
          output_sample_rate: 16000,
          agent_variables: { runtime_session_id: session.runtime_session_id, recording_consent: true },
        },
        audioInterface: input,
        stateCallback: setAgentState,
        endCallback: async () => { if (agent.current) await stop(); },
      });
      agent.current = current;
      await current.start();
      if (!(await current.waitForConnect(10))) throw new Error('The voice connection timed out.');
      setStatus('live');
      timer.current = setTimeout(() => void stop(), (config.session_seconds || 900) * 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Voice calling is unavailable.');
      await stop(false);
      setStatus('idle');
    }
  };

  if (!config?.enabled) return null;
  const liveLabel = muted ? 'Microphone muted' : agentState === AgentState.SPEAKING ? 'Assistant speaking' : 'Listening';
  return (
    <section className="voice-call" id="voice">
      <div className="voice-copy">
        <p className="eyebrow"><span /> Voice front desk</p>
        <h2>Book by speaking with {hospitalName}.</h2>
        <p>Ask about doctors, branches and live availability, then confirm the appointment during the call.</p>
        <div className="voice-security"><ShieldCheck /> The assistant can access only this hospital’s booking system.</div>
      </div>
      <div className={`voice-console ${status === 'live' ? 'active' : ''}`}>
        <span className="voice-orb"><Bot /></span>
        <strong>{config.agent_name}</strong>
        <p>{status === 'live' ? liveLabel : status === 'connecting' ? 'Connecting…' : status === 'ended' ? 'Call ended' : 'Ready to help'}</p>
        {status === 'idle' || status === 'ended' ? <>
          <label className="voice-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{config.recording_notice}</span></label>
          <button className="voice-start" disabled={!consent} onClick={() => void start()}>{status === 'idle' ? <Mic /> : <LoaderCircle />} Start voice call</button>
        </> : status === 'connecting' ? <button className="voice-start" disabled><LoaderCircle className="spin" /> Connecting</button> : <div className="voice-actions">
          <button onClick={() => { if (!agent.current) return; muted ? agent.current.unmute() : agent.current.mute(); setMuted(!muted); }} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <MicOff /> : <Mic />}</button>
          <button className="hangup" onClick={() => void stop()} aria-label="End call"><PhoneOff /></button>
        </div>}
        {error && <small className="voice-error">{error}</small>}
      </div>
    </section>
  );
}
