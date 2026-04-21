export type AppNotification = {
  id: string;
  type: 'success' | 'error' | 'alert';
  message: string;
};

type NotificationListener = (notification: AppNotification) => void;

const listeners = new Set<NotificationListener>();

export function notify(type: AppNotification['type'], message: string): void {
  const payload: AppNotification = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    message
  };
  listeners.forEach((listener) => listener(payload));
}

export function subscribeNotifications(listener: NotificationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
