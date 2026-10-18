import { useEffect } from "react";
import { ToastStackProvider, ToastStack, useToastStack } from "../arc/toast-stack/toast-stack";
import { attachToastStack } from "../toast-events";
function ToastBinding() {
  const { toast, update, dismiss } = useToastStack();
  useEffect(() => attachToastStack({ toast, update, dismiss }), [toast, update, dismiss]);
  return null;
}
export function Toaster(_props: { theme?: string } = {}) {
  return <ToastStackProvider><ToastBinding /><div className="arc-demo-scope"><ToastStack /></div></ToastStackProvider>;
}
