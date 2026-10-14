import { api } from './client'

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (details) => api.post('/auth/register', details),
  me: () => api.get('/auth/me'),
}
