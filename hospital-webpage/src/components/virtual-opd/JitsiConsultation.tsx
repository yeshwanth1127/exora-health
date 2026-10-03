import { useEffect, useRef } from 'react';
import type { JoinGrant } from '../../lib/teleconsultationApi';

declare global { interface Window { JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => { dispose: () => void; addListener: (event: string, listener: () => void) => void } } }

export function JitsiConsultation({ grant, onHangup }: { grant: JoinGrant; onHangup: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false; let api: { dispose: () => void; addListener: (event: string, listener: () => void) => void } | undefined;
    const mount = () => {
      if (disposed || !host.current || !window.JitsiMeetExternalAPI) return;
      const options: Record<string, unknown> = { roomName: grant.room_name,
        parentNode: host.current, width: '100%', height: '100%', userInfo: { displayName: grant.display_name },
        configOverwrite: { prejoinPageEnabled: false, disableDeepLinking: true } };
      if (grant.domain !== 'meet.jit.si') options.jwt = grant.jwt;
      api = new window.JitsiMeetExternalAPI(grant.domain, options);
      api.addListener('videoConferenceLeft', onHangup);
    };
    if (window.JitsiMeetExternalAPI) mount();
    else {
      const script = document.createElement('script'); script.src = `https://${grant.domain}/external_api.js`;
      script.async = true; script.onload = mount; script.dataset.exoraJitsi = 'true'; document.head.appendChild(script);
    }
    return () => { disposed = true; api?.dispose(); };
  }, [grant, onHangup]);
  return <div ref={host} className="w-full h-[68vh] min-h-[480px] rounded-2xl overflow-hidden bg-[#101714]" />;
}
