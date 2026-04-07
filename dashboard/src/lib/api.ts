import axios from "axios";
import Cookies from "js-cookie";
import { getPublicApiUrl } from "@/lib/env";

export const api = axios.create({
  baseURL: getPublicApiUrl(),
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

function cookieOptions(expires?: number): Cookies.CookieAttributes {
  const isSecureContext = typeof window !== "undefined" && window.location.protocol === "https:";

  return {
    expires,
    sameSite: "Strict",
    secure: isSecureContext,
    path: "/",
  };
}

export function getAccessToken() {
  return Cookies.get("accessToken") ?? null;
}

export function getRefreshToken() {
  return Cookies.get("refreshToken") ?? null;
}

// ─── Request Interceptor: attach access token ──────────
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor: auto-refresh on 401 ─────────
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  pendingQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          })
          .catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        isRefreshing = false;
        clearAuth();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          `${getPublicApiUrl()}/auth/refresh`,
          { refreshToken }
        );
        const newToken: string = data.accessToken;
        Cookies.set("accessToken", newToken, cookieOptions(1 / 96));
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuth();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export function setAuth(accessToken: string, refreshToken: string) {
  Cookies.set("accessToken", accessToken, cookieOptions(1 / 96));
  Cookies.set("refreshToken", refreshToken, cookieOptions(30));
}

export function clearAuth() {
  Cookies.remove("accessToken", { path: "/" });
  Cookies.remove("refreshToken", { path: "/" });
}

export function isAuthenticated(): boolean {
  return !!getAccessToken() || !!getRefreshToken();
}
