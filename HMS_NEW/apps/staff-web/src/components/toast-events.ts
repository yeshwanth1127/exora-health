import type { ToastOptions, ToastStackApi, ToastType } from "./arc/toast-stack/toast-stack";
export type NoticeOptions = Omit<ToastOptions, "title" | "type">;
let sequence = 0;
let sink: ToastStackApi | undefined;
let waiting: ToastOptions[] = [];
/** Receives the actual command result's message; never infers a save outcome. */
function notify(type: ToastType, title: string, options: NoticeOptions = {}) {
  const notice = { ...options, title, type, id: options.id ?? `workspace-toast-${++sequence}` };
  if (sink) sink.toast(notice);
  else waiting = [...waiting, notice].slice(-12);
  return notice.id;
}
export const toast = Object.assign((title: string, options?: NoticeOptions) => notify("info", title, options), {
  success: (title: string, options?: NoticeOptions) => notify("success", title, options),
  error: (title: string, options?: NoticeOptions) => notify("error", title, options),
  info: (title: string, options?: NoticeOptions) => notify("info", title, options),
  warning: (title: string, options?: NoticeOptions) => notify("warning", title, options),
  loading: (title: string, options?: NoticeOptions) => notify("loading", title, options),
  dismiss: (id?: string) => { waiting = id ? waiting.filter((notice) => notice.id !== id) : []; sink?.dismiss(id); },
});
export function attachToastStack(api: ToastStackApi) {
  sink = api;
  const pending = waiting;
  waiting = [];
  pending.forEach((notice) => api.toast(notice));
  return () => { if (sink === api) sink = undefined; };
}
