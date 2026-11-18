const TOKEN_KEY = "sportmind_token";
const ACCESS_TOKEN_KEY = "sportmind_access_token";
const REFRESH_TOKEN_KEY = "sportmind_refresh_token";
const USERNAME_KEY = "sportmind_username";
const REFRESH_BEFORE_EXPIRY_MS = 60_000;

type SessionState = "active" | "none" | "expired" | "unavailable";

class SessionExpiredError extends Error {}

class SessionUnavailableError extends Error {}

function decodePayload(token: string): Record<string, any> | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function tokenExpiry(token: string): number {
  const payload = decodePayload(token);
  return typeof payload?.exp === "number" ? payload.exp * 1000 : 0;
}

function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

function markSessionExpired(): void {
  clearSession();
  if (window.location.pathname !== "/login") {
    window.location.replace("/login?reason=expired");
  }
}

const nativeFetch = window.fetch.bind(window);
let refreshInFlight: Promise<string> | null = null;

export async function refreshSession(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) throw new SessionExpiredError("No hay un refresh token disponible.");

  refreshInFlight = (async () => {
    let response: Response;
    try {
      response = await nativeFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "refresh",
          refreshToken,
          email: localStorage.getItem(USERNAME_KEY) || "",
        }),
      });
    } catch {
      throw new SessionUnavailableError("No se pudo conectar para renovar la sesión.");
    }

    let result: any;
    try {
      result = await response.json();
    } catch {
      throw new SessionUnavailableError("La respuesta de renovación no es válida.");
    }

    if (!response.ok || !result?.success || !result?.token) {
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        throw new SessionExpiredError(result?.error || "La sesión ya no se puede renovar.");
      }
      throw new SessionUnavailableError(result?.error || "No se pudo renovar la sesión.");
    }

    localStorage.setItem(TOKEN_KEY, result.token);
    if (result.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
    if (result.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
    return result.token as string;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function restoreExistingSession(): Promise<SessionState> {
  const token = localStorage.getItem(TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (token && tokenExpiry(token) > Date.now() + REFRESH_BEFORE_EXPIRY_MS) {
    return "active";
  }
  if (!refreshToken) {
    if (token) clearSession();
    return token ? "expired" : "none";
  }

  try {
    await refreshSession();
    return "active";
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      clearSession();
      return "expired";
    }
    return "unavailable";
  }
}

function applyRoleAndReveal(token: string): boolean {
  const payload = decodePayload(token);
  if (!payload || tokenExpiry(token) <= Date.now()) return false;

  const groups = payload["cognito:groups"] || payload.groups || [];
  const isAdmin = Array.isArray(groups)
    ? groups.some((group: unknown) => String(group).toLowerCase().includes("admin"))
    : String(groups).toLowerCase().includes("admin");

  document.documentElement.classList.add("auth-ok");
  document.documentElement.classList.toggle("is-admin", isAdmin);

  const path = window.location.pathname;
  if (!isAdmin && (path.includes("/logs") || path.includes("/especialista/crear"))) {
    window.location.replace("/dashboard");
  }
  return true;
}

function scheduleRefresh(): void {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  const delay = Math.max(1_000, tokenExpiry(token) - Date.now() - REFRESH_BEFORE_EXPIRY_MS);
  window.setTimeout(async () => {
    try {
      const renewed = await refreshSession();
      if (!applyRoleAndReveal(renewed)) markSessionExpired();
      else scheduleRefresh();
    } catch (error) {
      if (error instanceof SessionExpiredError) markSessionExpired();
      else window.setTimeout(scheduleRefresh, 30_000);
    }
  }, delay);
}

function isProtectedApiRequest(request: Request): boolean {
  if (!request.headers.has("Authorization")) return false;
  const url = new URL(request.url);
  if (url.pathname === "/api/login") return false;
  if (url.origin === window.location.origin && url.pathname.startsWith("/api/")) return true;
  return url.hostname.includes("execute-api") && url.hostname.endsWith("amazonaws.com");
}

function installUnauthorizedRefresh(): void {
  const wrappedFetch: typeof window.fetch = async (input, init) => {
    let request: Request;
    try {
      request = new Request(input instanceof URL ? input.toString() : input, init);
    } catch {
      return nativeFetch(input, init);
    }

    const response = await nativeFetch(request.clone());
    if (response.status !== 401 || !isProtectedApiRequest(request)) return response;

    try {
      const newToken = await refreshSession();
      const headers = new Headers(request.headers);
      headers.set("Authorization", `Bearer ${newToken}`);
      const retry = await nativeFetch(new Request(request, { headers }));
      if (retry.status === 401) markSessionExpired();
      return retry;
    } catch (error) {
      if (error instanceof SessionExpiredError) markSessionExpired();
      return response;
    }
  };
  window.fetch = wrappedFetch;
}

export function initializeProtectedSession(): void {
  installUnauthorizedRefresh();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken || tokenExpiry(currentToken) <= Date.now() + REFRESH_BEFORE_EXPIRY_MS) {
      void refreshSession().then((newToken) => {
        if (!applyRoleAndReveal(newToken)) markSessionExpired();
      }).catch((error) => {
        if (error instanceof SessionExpiredError) markSessionExpired();
      });
    }
  });

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.replace("/login");
    return;
  }

  if (tokenExpiry(token) > Date.now() + REFRESH_BEFORE_EXPIRY_MS) {
    if (!applyRoleAndReveal(token)) {
      markSessionExpired();
      return;
    }
    scheduleRefresh();
    return;
  }

  void refreshSession().then((newToken) => {
    if (!applyRoleAndReveal(newToken)) markSessionExpired();
    else scheduleRefresh();
  }).catch((error) => {
    if (error instanceof SessionExpiredError) {
      markSessionExpired();
    } else {
      window.location.replace("/login?reason=unavailable");
    }
  });

}
