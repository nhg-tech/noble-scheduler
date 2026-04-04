// ─── Noble Scheduler API Client ──────────────────────────────────────────────
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

// Token stored in localStorage — survives page reloads
let _token = localStorage.getItem('noble_token') || null;

export function setToken(t) {
  _token = t;
  if (t) localStorage.setItem('noble_token', t);
  else   localStorage.removeItem('noble_token');
}

export function getToken() { return _token; }
export function isLoggedIn() { return !!_token; }

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Token expired or invalid — clear it so app re-prompts login
  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('noble:unauthorized'));
    throw new Error('Session expired — please log in again');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json();
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────
export async function apiLogin(email, password) {
  const data = await api.post('/auth/login', { email, password });
  setToken(data.token);
  return data.user;
}

export function apiLogout() {
  setToken(null);
}

export async function apiGetMe() {
  return api.get('/auth/me');
}

// ─── Setup helpers ────────────────────────────────────────────────────────────
export const apiSetup = {
  getTasks:      ()    => api.get('/setup/tasks'),
  saveTasks:     (obj) => api.put('/setup/tasks', obj),
  getRoles:      ()    => api.get('/setup/roles'),
  saveRoles:     (roles, columnOrder) => api.put('/setup/roles', { roles, columnOrder }),
  getProgramMix: ()    => api.get('/setup/program-mix'),
  saveProgramMix:(obj) => api.put('/setup/program-mix', obj),
  getSkills:     ()      => api.get('/setup/skills'),
  saveSkills:    (skills) => api.put('/setup/skills', skills),
  getStaff:      ()      => api.get('/setup/staff'),
  saveStaff:     (staff) => api.put('/setup/staff', staff),
  getCategories:    ()      => api.get('/setup/categories'),
  saveCategories:   (obj)   => api.put('/setup/categories', obj),
  createCategory:   (label) => api.post('/setup/categories', { label }),
};

// ─── Staffing helpers ────────────────────────────────────────────────────────
export const apiStaffing = {
  getProfiles:   () => api.get('/staffing/profiles'),
  saveProfiles:  (profiles) => api.put('/staffing/profiles', profiles),
};

// ─── Template helpers ─────────────────────────────────────────────────────────
export const apiTemplates = {
  getMaster:     ()           => api.get('/templates/master'),
  saveMaster:    (name, state) => api.post('/templates/master', { name, ...state }),
  deleteMaster:  (name)       => api.delete(`/templates/master/${encodeURIComponent(name)}`),
  getUser:       ()           => api.get('/templates/user'),
  saveUser:      (name, state) => api.post('/templates/user', { name, ...state }),
  deleteUser:    (name)       => api.delete(`/templates/user/${encodeURIComponent(name)}`),
};

// ─── Schedule helpers ─────────────────────────────────────────────────────────
export const apiSchedules = {
  getDrafts:    ()           => api.get('/schedules?status=draft'),
  getPostings:  ()           => api.get('/schedules?status=posted'),
  save:         (payload)    => api.post('/schedules', payload),
  update:       (id, payload)=> api.put(`/schedules/${id}`, payload),
  getOne:       (id)         => api.get(`/schedules/${id}`),
  post:         (id)         => api.post(`/schedules/${id}/post`, {}),
  delete:       (id)         => api.delete(`/schedules/${id}`),
};
