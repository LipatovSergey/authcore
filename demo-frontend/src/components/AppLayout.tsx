import { NavLink } from 'react-router-dom';

type AppLayoutProps = {
  children: React.ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-brand">AuthCore Demo</span>
        <nav className="app-nav">
          <NavLink to="/notifications">Notifications</NavLink>
        </nav>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
