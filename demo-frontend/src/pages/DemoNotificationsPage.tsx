import { useEffect, useState } from 'react';
import { getNotifications, type NotificationMessage } from '../api/demoApi';

function getNotificationTypeLabel(type: NotificationMessage['type']): string {
  if (type === 'email_verification') {
    return 'Email verification';
  }
  if (type === 'password_reset') {
    return 'Password reset';
  }
}

function formatNotificationDate(createdAt: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(createdAt));
}

export function DemoNotificationsPage() {
  const [notifications, setNotifications] =
    useState<NotificationMessage[]>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState(null);
  useEffect(() => {
    async function loadNotifications() {
      try {
        setIsLoading(true);
        setStatusMessage(null);

        const response = await getNotifications();
        setNotifications(response.messages);
      } catch {
        setStatusMessage({
          type: 'error',
          text: 'Failed to load notifications.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadNotifications();
  }, []);
  return (
    <>
      <h1>Notifications</h1>
      {isLoading && <p>Loading notifications...</p>}
      {!isLoading && statusMessage && (
        <p className={`status-message status-message-${statusMessage.type}`}>
          {statusMessage.text}
        </p>
      )}
      {!isLoading && !statusMessage && notifications.length === 0 && (
        <p>No notifications yet</p>
      )}
      {!isLoading && !statusMessage && notifications.length > 0 && (
        <ol>
          {notifications.map((notification) => (
            <li className="notifictaion-item" key={notification.id}>
              <div>
                <span>{getNotificationTypeLabel(notification.type)}</span>
                <time dateTime={notification.createdAt}>
                  {formatNotificationDate(notification.createdAt)}
                </time>
              </div>
              <p>To: {notification.to}</p>
              <a href={notification.link}>Open link</a>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
