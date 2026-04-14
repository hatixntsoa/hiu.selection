import { io, Socket } from 'socket.io-client';

function resolveSocketUrl(): string {
  const configuredApiUrl = import.meta.env.VITE_API_URL;
  if (configuredApiUrl) {
    if (configuredApiUrl.startsWith('http://') || configuredApiUrl.startsWith('https://')) {
      return configuredApiUrl.replace(/\/api\/?$/, '');
    }
    if (configuredApiUrl.startsWith('/')) {
      return window.location.origin;
    }
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (port === '3000' || port === '5173' || port === '4173') {
      return `${protocol}//${hostname}:3001`;
    }
  }

  return window.location.origin;
}

const SOCKET_URL = resolveSocketUrl();

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    auth: {
      token: localStorage.getItem('token') || ''
    },
    reconnection: true,
    reconnectionDelay: 300,
    reconnectionDelayMax: 1500
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
