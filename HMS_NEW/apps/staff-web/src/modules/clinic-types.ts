export type Doctor = {
  id: string;
  name: string;
  title: string;
  bio: string;
  experience_years: number | null;
  consultation_fee: number | null;
  is_active: boolean;
  accepts_virtual: boolean;
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
};
export type TimeBlock = {
  branch_id: string;
  consultation_type: string;
  starts_at_local: string;
  ends_at_local: string;
  slot_minutes: number;
};
export type Schedule = TimeBlock & {
  id: string;
  doctor_id: string;
  schedule_date: string;
  weekday: number;
  effective_from: string;
  effective_until: string | null;
  is_active: boolean;
};
export const clinicToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export const minute = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};
export const clockLabel = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
