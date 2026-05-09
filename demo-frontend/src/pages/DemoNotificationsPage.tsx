import { useEffect, useState } from 'react';
import {
  deleteNotifications,
  getNotifications,
  type NotificationMessage,
} from '../api/demoApi';
import { formatDate } from '../utils/formatDate';
import { LoadingOverlay } from '../components/LoadingOverlay';

type StatusMessage = { type: 'error'; text: string } | null;

type GroupedNotifications = {
  email_verification: NotificationMessage[];
  password_reset: NotificationMessage[];
};

function groupNotificationsByType(
  notifications: NotificationMessage[],
): GroupedNotifications {
  return notifications.reduce<GroupedNotifications>(
    (groups, notification) => {
      groups[notification.type].push(notification);
      return groups;
    },
    {
      email_verification: [],
      password_reset: [],
    },
  );
}

export function DemoNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [isLoading, setIsLoading] = useState(true);
  const groupedNotifications = groupNotificationsByType(notifications);

  useEffect(() => {
    let ignore = false;

    async function loadInitialNotifications() {
      try {
        const response = await getNotifications();

        if (!ignore) {
          setNotifications(response.messages);
        }
      } catch {
        if (!ignore) {
          setStatusMessage({
            type: 'error',
            text: 'Failed to load notifications.',
          });
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadInitialNotifications();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleRefresh() {
    setIsLoading(true);
    setStatusMessage(null);

    try {
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

  async function clearNotifications() {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      await deleteNotifications();
      setNotifications([]);
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Failed to clear notifications.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="notifications-page">
      {isLoading && <LoadingOverlay />}
      <header className="notifications-page-header">
        <h1>Notifications</h1>
        <div className="notifications-page-actions">
          <button
            className="button"
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            Refresh
          </button>
          <button
            className="button"
            type="button"
            onClick={clearNotifications}
            disabled={isLoading}
          >
            Clear
          </button>
        </div>
      </header>
      {!isLoading && statusMessage && (
        <p className={`status-message status-message-${statusMessage.type}`}>
          {statusMessage.text}
        </p>
      )}
      {!isLoading && !statusMessage && notifications.length === 0 && (
        <p>No notifications yet</p>
      )}
      {!isLoading && !statusMessage && notifications.length > 0 && (
        <section className="notifications-sections">
          <div className="notifications-section">
            <h2 className="notifications-section-title">Email verification</h2>
            <ul className="notifications-list">
              {groupedNotifications.email_verification.map((notification) => (
                <li className="notification-item" key={notification.id}>
                  <p className="notification-recipient">
                    To: {notification.to}
                  </p>
                  <time
                    className="notification-time"
                    dateTime={notification.createdAt}
                  >
                    {formatDate(notification.createdAt)}
                  </time>
                  <a
                    className="link notification-link"
                    href={notification.link}
                  >
                    Open link
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="notifications-section">
            <h2 className="notifications-section-title">Reset password</h2>
            <ul className="notifications-list">
              {groupedNotifications.password_reset.map((notification) => (
                <li className="notification-item" key={notification.id}>
                  <p className="notification-recipient">
                    To: {notification.to}
                  </p>
                  <time
                    className="notification-time"
                    dateTime={notification.createdAt}
                  >
                    {formatDate(notification.createdAt)}
                  </time>
                  <a
                    className="link notification-link"
                    href={notification.link}
                  >
                    Open link
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
