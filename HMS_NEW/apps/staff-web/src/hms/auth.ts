import {
  InMemoryWebStorage,
  UserManager,
  WebStorageStateStore,
} from "oidc-client-ts";
import { isDevelopmentLoginConfigured } from "@/hms/runtime-flags";
const authority = import.meta.env.VITE_OIDC_AUTHORITY,
  clientId = import.meta.env.VITE_OIDC_CLIENT_ID;
export const identityAccountUrl = authority
  ? `${authority.replace(/\/$/, "")}/account/#/security/signingin`
  : null;
export const devLoginEnabled =
  isDevelopmentLoginConfigured(import.meta.env.VITE_HMS_DEV_LOGIN);
export const devAutoSignInSubject = devLoginEnabled
  ? (import.meta.env.VITE_HMS_DEFAULT_SUBJECT?.trim() ?? "")
  : "";
export const oidc =
  authority && clientId
    ? new UserManager({
        authority,
        client_id: clientId,
        redirect_uri: `${location.origin}/staff/callback`,
        response_type: "code",
        scope: import.meta.env.VITE_OIDC_SCOPE || "openid profile email",
        userStore: new WebStorageStateStore({
          store: new InMemoryWebStorage(),
        }),
        stateStore: new WebStorageStateStore({ store: sessionStorage }),
        automaticSilentRenew: false,
        loadUserInfo: false,
        ...(import.meta.env.VITE_OIDC_AUDIENCE
          ? {
              extraQueryParams: {
                audience: import.meta.env.VITE_OIDC_AUDIENCE,
              },
            }
          : {}),
      })
    : null;
let callback: ReturnType<UserManager["signinRedirectCallback"]> | undefined;
export function finishLogin() {
  if (!oidc) throw new Error("Single sign-on is not configured.");
  return (callback ??= oidc.signinRedirectCallback());
}
