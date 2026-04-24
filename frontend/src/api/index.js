import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true
});

export const auth = {
    login: (username, password) =>
        api.post('/auth/login', { username, password }),
    logout: () =>
        api.post('/auth/logout'),
    me: () =>
        api.get('/auth/me')
};

export const users = {
    list: () =>
        api.get('/admin/users'),
    create: (data) =>
        api.post('/admin/users', data),
    update: (id, data) =>
        api.put(`/admin/users/${id}`, data),
    delete: (id) =>
        api.delete(`/admin/users/${id}`)
};

export const keys = {
    list: () =>
        api.get('/keys'),
    create: (data) =>
        api.post('/keys', data),
    delete: (id) =>
        api.delete(`/keys/${id}`),
    toggle: (id) =>
        api.put(`/keys/${id}/toggle`)
};

export const stats = {
    get: (period) =>
        api.get('/stats', { params: { period } }),
    logs: (limit, offset) =>
        api.get('/stats/logs', { params: { limit, offset } })
};

export default api;