import { describe, expect, it } from 'vitest';
import { compileVoiceManifest, defaultVoiceSettings, tenantBackendOrigin } from './voice-control.ts';

const tenant = (slug: string, publicUrl: string) => ({
  customerId: `customer-${slug}`, tenantId: `tenant-${slug}`, slug,
  hospitalName: `${slug} Hospital`, facilityName: 'Main', timezone: 'Asia/Kolkata', publicUrl,
});

describe('voice control compiler', () => {
  it('binds every tool to exactly one tenant backend', () => {
    const a = compileVoiceManifest(tenant('a', 'https://a.example.test/'), defaultVoiceSettings('A Hospital'));
    const b = compileVoiceManifest(tenant('b', 'https://b.example.test'), defaultVoiceSettings('B Hospital'));
    expect(a.tools.every(tool => tool.url.startsWith('https://a.example.test/api/v1/integrations/voice'))).toBe(true);
    expect(a.tools.some(tool => tool.url.includes('b.example.test'))).toBe(false);
    expect(b.tools.every(tool => tool.url.startsWith('https://b.example.test/api/v1/integrations/voice'))).toBe(true);
    expect(a.configurationHash).not.toBe(b.configurationHash);
  });

  it('removes disabled write tools while retaining live directory tools', () => {
    const settings = { ...defaultVoiceSettings('A Hospital'), actions: { book: false, lookup: true, cancel: false, reschedule: false } };
    const manifest = compileVoiceManifest(tenant('a', 'https://a.example.test'), settings);
    expect(manifest.tools.map(tool => tool.name)).toEqual(['list_branches', 'search_doctors', 'check_availability', 'get_doctor_schedule', 'lookup_appointment']);
  });

  it('rejects non-HTTPS, credentialed and fragmented backend URLs', () => {
    for (const url of ['http://a.example.test', 'https://user:pass@a.example.test', 'https://a.example.test/#tenant=b']) {
      expect(() => tenantBackendOrigin(url)).toThrow();
    }
  });

  it('produces a stable configuration hash', () => {
    const first = compileVoiceManifest(tenant('a', 'https://a.example.test'), defaultVoiceSettings('A Hospital'));
    const second = compileVoiceManifest(tenant('a', 'https://a.example.test/'), defaultVoiceSettings('A Hospital'));
    expect(first.configurationHash).toBe(second.configurationHash);
  });
});
