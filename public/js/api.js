// API client
const KEY = 'palu.session';

export const session = {
  get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } },
  set(s) { localStorage.setItem(KEY, JSON.stringify(s)); },
  clear() { localStorage.removeItem(KEY); },
};

export class ApiError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

export async function api(path, { method = 'GET', body, raw = false, timeout = 15000 } = {}) {
  const s = session.get();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (s && s.token) headers.Authorization = 'Bearer ' + s.token;
  let res;
  try {
    res = await fetch('/api' + path, { method, headers, signal: AbortSignal.timeout(timeout), cache: 'no-store', body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }
  if (raw) {
    if (!res.ok) throw new ApiError(res.status, 'Download failed.');
    return res;
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (res.ok && data === null) throw new ApiError(502, 'The server returned an invalid response. Please try again.');
  if (!res.ok) {
    if (res.status === 401 && path !== '/login') {
      session.clear();
      window.dispatchEvent(new CustomEvent('palu:logout'));
    }
    throw new ApiError(res.status, (data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

export async function download(path, filename) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

