export type NotificationInput = { id: string; feature?: string; project?: string; title: string; message: string; severity?: 'info'|'warning'|'error'; href?: string; action?: string };
export function publishNotification(input: NotificationInput): void;
export function resolveNotification(id: string): void;
export function dismissNotification(id: string): void;
export function notificationSnapshot(): Array<NotificationInput & { resolved: boolean; dismissed: boolean }>;
export function bindNotifications(root: HTMLElement): () => void;
