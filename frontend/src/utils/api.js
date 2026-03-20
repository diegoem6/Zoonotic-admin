import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('z2_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear token and redirect to login
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('z2_token');
      localStorage.removeItem('z2_user');
      window.location.href = '/login';
    }
    const msg = err.response?.data?.error || err.message || 'Error desconocido';
    return Promise.reject(new Error(msg));
  }
);

// AUTH
export const login = (data) => api.post('/auth/login', data);
export const getMe  = ()     => api.get('/auth/me');

// CLIENTS
export const getClients    = ()        => api.get('/clients');
export const getClient     = (id)      => api.get(`/clients/${id}`);
export const createClient  = (data)    => api.post('/clients', data);
export const updateClient  = (id, d)   => api.put(`/clients/${id}`, d);
export const deleteClient  = (id)      => api.delete(`/clients/${id}`);

// COLLABORATORS
export const getCollaborators    = ()       => api.get('/collaborators');
export const getCollaborator     = (id)     => api.get(`/collaborators/${id}`);
export const createCollaborator  = (data)   => api.post('/collaborators', data);
export const updateCollaborator  = (id, d)  => api.put(`/collaborators/${id}`, d);
export const deleteCollaborator  = (id)     => api.delete(`/collaborators/${id}`);

// PROJECTS
export const getProjects     = (params)   => api.get('/projects', { params });
export const getProject      = (id)       => api.get(`/projects/${id}`);
export const createProject   = (data)     => api.post('/projects', data);
export const updateProject   = (id, data) => api.put(`/projects/${id}`, data);
export const deleteProject   = (id)       => api.delete(`/projects/${id}`);
export const uploadQuote     = (id, file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post(`/projects/${id}/quote`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const getProjectHours    = (id)         => api.get(`/projects/${id}/hours`);
export const addProjectHours    = (id, data)   => api.post(`/projects/${id}/hours`, data);
export const deleteProjectHours = (id, hourId) => api.delete(`/projects/${id}/hours/${hourId}`);

// EXPENSES
export const getExpenses      = (params) => api.get('/expenses', { params });
export const createExpense    = (data)   => api.post('/expenses', data);
export const updateExpense    = (id, d)  => api.put(`/expenses/${id}`, d);
export const deleteExpense    = (id)     => api.delete(`/expenses/${id}`);

// TAXES
export const getTaxes   = (params) => api.get('/taxes', { params });
export const saveTax    = (data)   => api.post('/taxes', data);
export const updateTax  = (id, d)  => api.put(`/taxes/${id}`, d);
export const deleteTax  = (id)     => api.delete(`/taxes/${id}`);
export const getIvaCalc = (params) => api.get('/taxes/iva-calc', { params });

// BILLING
export const getBillingSummary = (params) => api.get('/billing/summary', { params });
export const getBillingCombined = (params) => api.get('/billing/summary/combined', { params });

// CASHFLOW
export const getCashflow = (params) => api.get('/cashflow', { params });

// DOLAR
export const getDolar      = ()          => api.get('/dolar');
export const setDolarManual = (rate)     => api.post('/dolar/manual', { rate });

export default api;
