import { apiRequest } from './client';

export interface NotificationMessage {
  id: string;
  type: 'email_verification' | 'password_reset';
  to: string;
  link: string;
  createdAt: string;
}
interface GetNotificationsResponse {
  messages: NotificationMessage[];
}
export function getNotifications() {
  return apiRequest<GetNotificationsResponse>({
    path: '/demo/notifications-outbox',
    method: 'GET',
  });
}

interface DeleteNotificationsResponse {
  message: string;
}
export function deleteNotifications() {
  return apiRequest<DeleteNotificationsResponse>({
    path: '/demo/notifications-outbox',
    method: 'DELETE',
  });
}
