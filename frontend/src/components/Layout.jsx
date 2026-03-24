import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './UI';
import { useAuth } from '../context/AuthContext';
import { getDolar, setDolarManual } from '../utils/api';

const navItems = [
  { to: '/',              icon: 'dashboard',     label: 'Dashboard' },
  { to: '/projects',      icon: 'projects',      label: 'Proyectos' },
  { to: '/clients',       icon: 'clients',       label: 'Clientes' },
  { to: '/collaborators', icon: 'collaborators', label: 'Colaboradores' },
  { to: '/billing',       icon: 'billing',       label: 'Resumen Facturación' },
  { to: '/expenses',      icon: 'expenses',      label: 'Egresos' },
  { to: '/taxes',         icon: 'taxes',         label: 'Aportes / Impuestos' },
  { to: '/cashflow',      icon: 'cashflow',      label: 'Flujo de Caja' },
  { to: '/payments',      icon: 'expenses',      label: 'Pagos' },
];

function DolarWidget() {
  const [dolar, setDolar]   = useState(null);
  const [editing, setEditing] = useState(false);
  const [val, setVal]       = useState('');

  const fetch = async () => {
    try { const d = await getDolar(); setDolar(d); } catch {}
  };

  useEffect(() => { fetch(); }, []);

  const save = async () => {
    try { const d = await setDolarManual(val); setDolar(d); setEditing(false); }
    catch {}
  };

  const rate = dolar?.rate;

  return (
    <div style={{
      margin: '0 8px 8px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
        USD Billete hoy
      </div>
      {editing ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="number" step="0.01"
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="ej. 43.50"
            style={{ fontSize: 12, padding: '4px 8px', width: '100%' }}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={save}>✓</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>✕</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {rate ? (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>
                $ {Number(rate).toFixed(2)}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No disponible</span>
            )}
            {dolar?.source === 'manual' && (
              <span style={{ fontSize: 10, color: 'var(--yellow)', marginLeft: 4 }}>manual</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-ghost btn-icon" title="Actualizar" onClick={fetch} style={{ padding: '3px' }}>
              <Icon name="refresh" size={12} />
            </button>
            <button className="btn btn-ghost btn-icon" title="Ingresar manualmente" onClick={() => { setVal(rate || ''); setEditing(true); }} style={{ padding: '3px' }}>
              <Icon name="edit" size={12} />
            </button>
          </div>
        </div>
      )}
      {dolar?.date && !editing && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{dolar.date}</div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, signOut } = useAuth();

  const handleLogout = () => { signOut(); navigate('/login'); };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Z2_</h1>
          <span>Gestión Empresarial</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon name={icon} size={16} className="nav-icon" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Dollar rate widget */}
        <DolarWidget />

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 2 }}>
              Zoonotic · Ingeuy
            </div>
            {user?.username && <span>👤 {user.username}</span>}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', color: 'var(--red)' }} onClick={handleLogout}>
            <Icon name="close" size={13} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main-area">
        <div className="topbar">
          <h2>{navItems.find(i => {
            if (i.to === '/') return location.pathname === '/';
            return location.pathname.startsWith(i.to);
          })?.label || 'Z2'}</h2>
          <div className="topbar-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <Icon name="building" size={14} />
              {user?.username || 'Admin'}
            </div>
          </div>
        </div>
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
