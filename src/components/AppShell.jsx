import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/authService';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Tableau de bord', icon: 'home' },
  { to: '/contributions', label: 'Cotisations', icon: 'coins' },
  { to: '/expenses', label: 'Dépenses', icon: 'receipt' },
  { to: '/members', label: 'Membres', icon: 'users' },
  { to: '/join-requests', label: 'Demandes', icon: 'inbox' },
  { to: '/activity', label: 'Activité', icon: 'clock' },
];

const ADMIN_ITEMS = [
  { to: '/admin', label: 'Administration', icon: 'shield' },
];

const ICONS = {
  home: 'M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9',
  coins: 'M8 8a5 3 0 1 0 10 0 5 3 0 1 0-10 0zm0 0v4a5 3 0 0 0 10 0V8M6 12a5 3 0 0 0 8.5 3.2M6 12v4a5 3 0 0 0 8.5 3.2',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6',
  users: 'M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20v-1a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  clock: 'M12 8v4l3 3M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
};

function Icon({ name, size = 18 }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ShellStyles = () => (
  <style>{`
    .lc-shell {
      display: flex;
      min-height: 100vh;
      background: #F6F3EC;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    }

    .lc-sidebar {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: 260px;
      flex-shrink: 0;
      background: #0F2A22;
      color: #EDE7DC;
      padding: 20px 16px;
    }

    .lc-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px 20px;
    }

    .lc-brand-mark {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #E8B24A, #C98A2A);
      display: grid;
      place-items: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .lc-brand-title {
      margin: 0;
      font-weight: 700;
      font-size: 17px;
      line-height: 1.1;
    }

    .lc-brand-subtitle {
      margin: 2px 0 0;
      font-size: 11px;
      color: #C9A24B;
      text-transform: uppercase;
      letter-spacing: .06em;
    }

    .lc-nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 8px;
    }

    .lc-nav__link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      color: rgba(237,231,220,.75);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: background .15s ease, color .15s ease;
    }

    .lc-nav__link:hover {
      background: rgba(237,231,220,.06);
      color: #EDE7DC;
    }

    .lc-nav__link--active {
      background: #E8B24A;
      color: #0F2A22;
      font-weight: 700;
    }

    .lc-sidebar-footer {
      position: relative;
      overflow: hidden;
      border-radius: 16px;
      margin-top: 24px;
      min-height: 220px;
      display: flex;
      align-items: flex-end;
      background-image:
        linear-gradient(to top, rgba(10,20,15,.92), rgba(10,20,15,.35) 55%, rgba(10,20,15,.15)),
        url('https://images.unsplash.com/photo-1661025208052-f4f54db8d743?fm=jpg&q=80&w=800&auto=format&fit=crop');
      background-size: cover;
      background-position: center;
    }

    .lc-sidebar-quote {
      padding: 18px;
      font-size: 13px;
      font-style: italic;
      line-height: 1.5;
      color: #F3EFE4;
    }

    .lc-nav-toggle {
      display: none;
    }

    .lc-topbar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 28px;
      background: #F6F3EC;
      border-bottom: 1px solid rgba(15,42,34,.08);
    }

    .lc-search {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff;
      border: 1px solid rgba(15,42,34,.1);
      border-radius: 10px;
      padding: 9px 14px;
      color: #6B7268;
      font-size: 14px;
    }

    .lc-topbar-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .lc-bell {
      position: relative;
      color: #0F2A22;
    }

    .lc-bell-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      background: #C0392B;
      color: white;
      font-size: 10px;
      font-weight: 700;
      border-radius: 999px;
      padding: 1px 5px;
    }

    .lc-user {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .lc-user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #0F2A22;
      color: #EDE7DC;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 700;
    }

    .lc-user-name {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      color: #18211D;
    }

    .lc-user-role {
      margin: 0;
      font-size: 11px;
      color: #7A8177;
    }

    .lc-signout {
      background: none;
      border: 1px solid rgba(15,42,34,.15);
      color: #18211D;
      border-radius: 8px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .lc-signout:hover { background: rgba(15,42,34,.05); }

    .lc-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .lc-content {
      flex: 1;
      padding: 24px 28px 40px;
    }

    @media (max-width: 880px) {
      .lc-sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        z-index: 40;
        transform: translateX(-100%);
        transition: transform .2s ease;
      }
      .lc-sidebar.lc-sidebar--open { transform: translateX(0); }
      .lc-nav-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 8px;
        border: 1px solid rgba(15,42,34,.15);
        background: #fff;
        color: #18211D;
        cursor: pointer;
      }
      .lc-topbar { padding: 12px 16px; }
      .lc-content { padding: 16px; }
      .lc-user-name, .lc-user-role { display: none; }
    }
  `}</style>
);

export default function AppShell({ children }) {
  const { profile, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const items = isAdmin ? [...NAV_ITEMS, ...ADMIN_ITEMS] : NAV_ITEMS;
  const fullName = profile?.full_name || 'Profil';
  const initials = fullName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="lc-shell">
      <ShellStyles />

      <aside className={`lc-sidebar ${menuOpen ? 'lc-sidebar--open' : ''}`}>
        <div>
          <div className="lc-brand">
            <span className="lc-brand-mark" aria-hidden="true">⌂</span>
            <div>
              <p className="lc-brand-title">La Caisse</p>
              <p className="lc-brand-subtitle">Gestion Familiale</p>
            </div>
          </div>

          <nav id="primary-nav" className="lc-nav">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `lc-nav__link ${isActive ? 'lc-nav__link--active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="lc-sidebar-footer" aria-hidden="true">
          <p className="lc-sidebar-quote">
            « Ensemble,<br />construisons un avenir<br />plus solide. »
          </p>
        </div>
      </aside>

      <div className="lc-main">
        <header className="lc-topbar">
          <button
            className="lc-nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="sr-only">Ouvrir le menu</span>
            ☰
          </button>

          <div className="lc-search">
            <Icon name="clock" size={0} />
            🔍 <span>Rechercher…</span>
          </div>

          <div className="lc-topbar-right">
            <div className="lc-bell" aria-hidden="true">
              🔔
            </div>

            <NavLink to="/profile" className="lc-user" style={{ textDecoration: 'none' }}>
              <div className="lc-user-avatar">{initials || '?'}</div>
              <div>
                <p className="lc-user-name">{fullName}</p>
                <p className="lc-user-role">{isAdmin ? 'Administrateur' : 'Membre'}</p>
              </div>
            </NavLink>

            <button className="lc-signout" onClick={handleSignOut}>
              Se déconnecter
            </button>
          </div>
        </header>

        <main className="lc-content">{children}</main>
      </div>
    </div>
  );
}
