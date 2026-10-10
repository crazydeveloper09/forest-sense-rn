import { readJson, sendJson } from "../http.mjs";
import { syncObservations } from "../sync/observations.mjs";
import {
  attachEncryptedProfile,
  loginAccount,
  logoutAccount,
  registerAccount,
  userFromRequest,
  verifyMfa,
} from "./service.mjs";

const AUTH_BODY_LIMIT = 64 * 1024;
const SYNC_BODY_LIMIT = 2 * 1024 * 1024;

export async function handleAuthRequest(request, response, url) {
  if (request.method === "GET" && url.pathname === "/auth/session") {
    sendJson(response, 200, await userFromRequest(request));
    return true;
  }
  if (request.method !== "POST") return false;

  if (url.pathname === "/auth/register") {
    sendJson(response, 201, await registerAccount(await readJson(request, AUTH_BODY_LIMIT)));
    return true;
  }
  if (url.pathname === "/auth/profile") {
    sendJson(response, 200, await attachEncryptedProfile(await readJson(request, AUTH_BODY_LIMIT)));
    return true;
  }
  if (url.pathname === "/auth/login") {
    sendJson(response, 200, await loginAccount(await readJson(request, AUTH_BODY_LIMIT)));
    return true;
  }
  if (url.pathname === "/auth/mfa/verify") {
    sendJson(response, 200, await verifyMfa(await readJson(request, AUTH_BODY_LIMIT)));
    return true;
  }
  if (url.pathname === "/auth/logout") {
    sendJson(response, 200, await logoutAccount(request));
    return true;
  }
  return false;
}

export async function handleSyncRequest(request, response, url) {
  if (request.method !== "POST" || url.pathname !== "/sync/observations") return false;
  const user = await userFromRequest(request);
  const body = await readJson(request, SYNC_BODY_LIMIT);
  sendJson(response, 200, await syncObservations(user.id, body));
  return true;
}
