export const SETTINGS_SECTIONS = [
  ["team", "Team"],
  ["roles", "Roles & access"],
  ["booking", "Booking policy"],
  ["modules", "Modules"],
  ["registrations", "Professional registrations"],
  ["consent-documents", "Consent documents"],
  ["appearance", "Appearance"],
  ["account", "My account"],
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number][0];
export function settingsSection(
  requested: string | null,
  permitted: SettingsSection[],
): SettingsSection {
  return permitted.find((id) => id === requested) ?? permitted[0] ?? "account";
}
