import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { hasStoredSession } from '../auth/tokenStorage';
import { AUTH_SESSION_CHANGED_EVENT } from '../auth/authSessionEvents';

type AppLayoutProps = {
  children: React.ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(hasStoredSession());
  useEffect(() => {
    function handleAuthSessionChanged() {
      setIsAuthenticated(hasStoredSession());
    }

    window.addEventListener(
      AUTH_SESSION_CHANGED_EVENT,
      handleAuthSessionChanged,
    );

    return () => {
      window.removeEventListener(
        AUTH_SESSION_CHANGED_EVENT,
        handleAuthSessionChanged,
      );
    };
  }, []);
  return (
    <div className="app-shell">
      <header className="app-header">
        <nav className="app-nav">
          {isAuthenticated && (
            <NavLink className="app-nav-link" to="/me">
              Profile
            </NavLink>
          )}
          <NavLink className="app-nav-link" to="/notifications">
            Notifications
          </NavLink>
          <NavLink className="app-nav-link" to="/login">
            Sign In
          </NavLink>
        </nav>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
