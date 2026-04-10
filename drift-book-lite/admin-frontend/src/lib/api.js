import axios from "axios";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").trim();
const apiOrigin = apiBaseUrl.startsWith("http") ? new URL(apiBaseUrl).origin : "";

export const api = axios.create({
  baseURL: apiBaseUrl,
});

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function requestMessage(error, fallback) {
  return error.response?.data?.message || fallback;
}

export function isUnauthorized(error) {
  return error.response?.status === 401;
}

export function assetUrl(input) {
  if (!input) return null;
  if (input.startsWith("http")) return input;
  if (apiOrigin && input.startsWith("/")) return `${apiOrigin}${input}`;
  return input;
}
