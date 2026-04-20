import axios from 'axios';
import { notify } from './notifications';

function resolveApiUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (port === '3000' || port === '5173' || port === '4173') {
      return `${protocol}//${hostname}:3001/api`;
    }
  }

  return '/api';
}

const API_URL = resolveApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const method = String(response.config?.method || 'get').toLowerCase();
    const isMutating = method === 'post' || method === 'put' || method === 'patch' || method === 'delete';
    const message = response.data?.message;
    if (isMutating && typeof message === 'string' && message.trim().length > 0) {
      notify('success', message);
    }
    return response;
  },
  (error) => {
    const method = String(error.config?.method || 'get').toLowerCase();
    const isMutating = method === 'post' || method === 'put' || method === 'patch' || method === 'delete';
    const message = error.response?.data?.error;
    if (isMutating && typeof message === 'string' && message.trim().length > 0) {
      notify('error', message);
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('team');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

export default api;
