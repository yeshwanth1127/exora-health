import { useState } from 'react';
export function HmsDoctorPhoto({ name, url, className = '' }: { name: string; url: string | null; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (url && url !== failedUrl) return <img src={url} alt="" loading="lazy" className={className} onError={() => setFailedUrl(url)} />;
  const initials = name.replace(/^dr\.?\s*/i, '').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('');
  return <span aria-label={`Photo unavailable for ${name}`} className={`flex items-center justify-center bg-[#dce8de] text-[#547859] text-5xl font-medium ${className}`}>{initials}</span>;
}
