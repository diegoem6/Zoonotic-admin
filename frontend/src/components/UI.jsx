import React from 'react';

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────
export const Icon = ({ name, size = 16, className = '' }) => {
  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    projects: <><path d="M3 3h18v4H3zM3 10h11v4H3zM3 17h7v4H3z"/></>,
    clients: <><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M19 7v4m2-2h-4"/></>,
    collaborators: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    billing: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
    expenses: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/></>,
    taxes: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></>,
    cashflow: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></>,
    close: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    chevronDown: <polyline points="6 9 12 15 18 9"/>,
    chevronRight: <polyline points="9 18 15 12 9 6"/>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    upload: <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    check: <polyline points="20 6 9 17 4 12"/>,
    alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10"/><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
    externalLink: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    zap: <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {icons[name] || null}
    </svg>
  );
};

// ─── Badge ────────────────────────────────────────────────────────────────────
export const StatusBadge = ({ status }) => {
  const map = {
    'Cobrado':        'badge-cobrado',
    'Facturado':      'badge-facturado',
    'En Ejecución':   'badge-ejecucion',
    'Falta Cotizar':  'badge-cotizar',
    'Falta OC':       'badge-oc',
  };
  return <span className={`badge ${map[status] || 'badge-neutral'}`}>{status}</span>;
};

export const RazonBadge = ({ razon }) => (
  <span className={`badge ${razon === 'Zoonotic' ? 'badge-zoonotic' : 'badge-ingeuy'}`}>{razon}</span>
);

export const CurrencyBadge = ({ currency }) => (
  <span className={`badge ${currency === 'USD' ? 'badge-usd' : 'badge-uyu'}`}>{currency}</span>
);

export const ConditionBadge = ({ condition }) => {
  const map = {
    'Empleado':             'badge-facturado',
    'Contratado por horas': 'badge-cotizar',
    'Coparticipante':       'badge-ejecucion',
    'Socio':                'badge-oc',
  };
  return <span className={`badge ${map[condition] || 'badge-neutral'}`}>{condition}</span>;
};

// ─── Spinner ──────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 20 }) => (
  <div className="spinner" style={{ width: size, height: size }} />
);

export const LoadingPage = () => (
  <div className="loading-page">
    <Spinner size={24} />
    <span>Cargando...</span>
  </div>
);

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
export const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div className="modal-overlay">
    <div className="modal modal-sm">
      <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
        <div style={{ marginBottom: 16, color: 'var(--red)' }}>
          <Icon name="alert" size={40} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>¿Confirmar eliminación?</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{message || 'Esta acción no se puede deshacer.'}</p>
      </div>
      <div className="modal-footer" style={{ justifyContent: 'center' }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-danger" onClick={onConfirm}>Eliminar</button>
      </div>
    </div>
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
export const EmptyState = ({ icon = 'file', title = 'Sin datos', subtitle }) => (
  <div className="empty-state">
    <Icon name={icon} size={48} />
    <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</p>
    {subtitle && <p>{subtitle}</p>}
  </div>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastFn = null;
export const toast = (msg, type = 'success') => { if (_toastFn) _toastFn(msg, type); };

export const ToastProvider = () => {
  const [toasts, setToasts] = React.useState([]);
  _toastFn = (msg, type) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  if (!toasts.length) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} className={`alert alert-${t.type === 'error' ? 'error' : t.type === 'warning' ? 'warning' : 'success'}`}
          style={{ minWidth: 260, boxShadow: 'var(--shadow-lg)', animation: 'none' }}>
          <Icon name={t.type === 'error' ? 'alert' : 'check'} size={16} />
          {t.msg}
        </div>
      ))}
    </div>
  );
};
