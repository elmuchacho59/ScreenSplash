import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Assets API
export const assetsApi = {
    getAll: (params = {}) => api.get('/assets', { params }),
    getOne: (id) => api.get(`/assets/${id}`),
    create: (formData) => api.post('/assets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    createUrl: (data) => api.post('/assets', data),
    update: (id, data) => api.put(`/assets/${id}`, data),
    delete: (id) => api.delete(`/assets/${id}`),
    getFile: (id) => `${API_BASE}/assets/${id}/file`,
    getThumbnail: (id) => `${API_BASE}/assets/${id}/thumbnail`
};

// Playlists API
export const playlistsApi = {
    getAll: (includeAssets = false) =>
        api.get('/playlists', { params: { include_assets: includeAssets } }),
    getOne: (id) => api.get(`/playlists/${id}`),
    create: (data) => api.post('/playlists', data),
    update: (id, data) => api.put(`/playlists/${id}`, data),
    delete: (id) => api.delete(`/playlists/${id}`),
    getAssets: (id) => api.get(`/playlists/${id}/assets`),
    addAsset: (id, assetId, customDuration = null) =>
        api.post(`/playlists/${id}/assets`, { asset_id: assetId, custom_duration: customDuration }),
    removeAsset: (playlistId, playlistAssetId) =>
        api.delete(`/playlists/${playlistId}/assets/${playlistAssetId}`),
    reorderAssets: (id, order) =>
        api.put(`/playlists/${id}/assets/reorder`, { order }),
    updateAsset: (playlistId, playlistAssetId, data) =>
        api.put(`/playlists/${playlistId}/assets/${playlistAssetId}`, data)
};

// Schedules API
export const schedulesApi = {
    getAll: () => api.get('/schedules'),
    getOne: (id) => api.get(`/schedules/${id}`),
    create: (data) => api.post('/schedules', data),
    update: (id, data) => api.put(`/schedules/${id}`, data),
    delete: (id) => api.delete(`/schedules/${id}`),
    getActive: () => api.get('/schedules/active')
};

// System API
export const systemApi = {
    getStatus: () => api.get('/system/status'),
    getInfo: () => api.get('/system/info'),
    getLogs: (limit = 50) => api.get('/system/logs', { params: { limit } }),
    getConfig: () => api.get('/system/config'),
    updateConfig: (data) => api.put('/system/config', data),
    health: () => api.get('/system/health')
};

// Player API
export const playerApi = {
    getCurrent: () => api.get('/player/current'),
    getNext: (playlistId, currentPosition) =>
        api.get('/player/next', { params: { playlist_id: playlistId, current: currentPosition } }),
    updateStatus: (data) => api.post('/player/status', data)
};

export default api;
