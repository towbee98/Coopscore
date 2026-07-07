import type { CooperativeDTO } from "@coopscore/shared";

const TOKEN_KEY = "coopscore_token";
const COOPERATIVE_KEY = "coopscore_cooperative";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCooperative(): CooperativeDTO | null {
  const raw = localStorage.getItem(COOPERATIVE_KEY);
  return raw ? (JSON.parse(raw) as CooperativeDTO) : null;
}

export function setSession(token: string, cooperative: CooperativeDTO): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(COOPERATIVE_KEY, JSON.stringify(cooperative));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(COOPERATIVE_KEY);
}
