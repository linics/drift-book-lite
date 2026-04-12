import { useState } from "react";

const ADMIN_TOKEN_KEY = "drift-book-admin-token";

export function getAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token) {
  if (!token) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function useAdminSession() {
  const [token, setTokenState] = useState(() => getAdminToken());

  function update(nextToken) {
    setAdminToken(nextToken);
    setTokenState(nextToken);
  }

  return { token, setToken: update };
}
