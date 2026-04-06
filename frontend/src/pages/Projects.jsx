import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  getProjects, getClients, getCollaborators, createProject, updateProject, deleteProject, getDolar
} from '../utils/api';
import {
  fmtUSD, fmtUYU, fmtDate, STATUSES, RAZONES, CURRENCIES, PROJECT_TYPES, CONDITIONS
} from '../utils/helpers';
import {
  Icon, StatusBadge, RazonBadge, CurrencyBadge, ConfirmDialog, Spinner, EmptyState, toast
} from '../components/UI';

const IVA_RATES = [
  { label: '0%',  value: 0 },
  { label: '22%', value: 0.22 },
];

const EMPTY = {
  name: '', status: 'Falta Cotizar', client_id: '', requestor: '', po: '', type: '',
  hours_estimated: '', billing_date: '', razon_social: '', invoice_number: '', currency: 'USD',
  iva_rate: 0.22, dolar_at_billing: '',
  subtotal_usd: '', iva_usd: '', total_usd: '',
  subtotal_uyu: '', iva_uyu: '', total_uyu: '',
  possible_payment_date: '', actual_payment_date: '', comments: '', owners: []
};

// Add 30 days to a YYYY-MM-DD string
function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function Projects() {
  const [projects, setProjects]         = useState([]);
  const [clients, setClients]           = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null);
  const [form, setForm]                 = useState(EMPTY);
  const [saving, setSaving]             = useState(false);
  const [deleteId, setDeleteId]         = useState(null);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRazon, setFilterRazon]   = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const load = useCallback(async () => {
    setLoading(true);
    const [p, c, co] = await Promise.all([getProjects(), getClients(), getCollaborators()]);
    setProjects(p); setClients(c); setCollaborators(co);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const { editId, openCreate, filterStatus } = location.state || {};
    if (filterStatus) {
      setFilterStatus(filterStatus);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    if (!editId && !openCreate) return;
    if (openCreate) {
      setForm(EMPTY);
      setModal('create');
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    if (!projects.length) return;
    const toEdit = projects.find(pr => pr.id === editId);
    if (toEdit) {
      openEdit(toEdit);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [projects, location.state?.editId, location.state?.openCreate, location.state?.filterStatus]);

  // Get referentes for selected client
  const selectedClient = clients.find(c => String(c.id) === String(form.client_id));
  const referentes = selectedClient?.referentes || [];

  const fetchAndSetDolar = async (currentForm) => {
    if (currentForm.currency === 'USD' && !currentForm.dolar_at_billing) {
      try {
        const d = await getDolar();
        if (d.rate) setForm(f => ({ ...f, dolar_at_billing: d.rate }));
      } catch {}
    }
  };

  const openCreate = () => {
    setForm(EMPTY);
    setModal('create');
    fetchAndSetDolar(EMPTY);
  };
  const openEdit = (p) => {
    const f = {
      ...p,
      iva_rate: p.iva_rate !== undefined ? p.iva_rate : 0.22,
      client_id: p.client_id || '',
      billing_date: p.billing_date ? p.billing_date.split('T')[0] : '',
      possible_payment_date: p.possible_payment_date ? p.possible_payment_date.split('T')[0] : '',
      actual_payment_date: p.actual_payment_date ? p.actual_payment_date.split('T')[0] : '',
      dolar_at_billing: p.dolar_at_billing || '',
      comments: p.comments || '',
      owners: p.owners || []
    };
    setForm(f);
    setModal(p.id);
    fetchAndSetDolar(f);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Recalculate IVA and totals whenever subtotal or rate changes
  const recalc = (newForm) => {
    const rate  = parseFloat(newForm.iva_rate) || 0;
    const subUSD = parseFloat(newForm.subtotal_usd) || 0;
    const subUYU = parseFloat(newForm.subtotal_uyu) || 0;
    return {
      ...newForm,
      iva_usd:   (subUSD * rate).toFixed(2),
      total_usd: (subUSD * (1 + rate)).toFixed(2),
      iva_uyu:   (subUYU * rate).toFixed(2),
      total_uyu: (subUYU * (1 + rate)).toFixed(2),
    };
  };

  const setAndRecalc = (k, v) => {
    setForm(f => recalc({ ...f, [k]: v }));
  };

  // Auto-set possible_payment_date when billing_date changes
  const setBillingDate = (v) => {
    setForm(f => ({
      ...f,
      billing_date: v,
      possible_payment_date: v ? addDays(v, 30) : f.possible_payment_date,
    }));
  };

  // Owners management
  const addOwner = (type, collabId) => {
    if (type === 'Z2') {
      if (form.owners.some(o => o.owner_type === 'Z2')) return;
      setForm(f => ({ ...f, owners: [...f.owners, { owner_type: 'Z2', collaborator_id: null }] }));
    } else if (collabId) {
      if (form.owners.some(o => String(o.collaborator_id) === String(collabId))) return;
      setForm(f => ({ ...f, owners: [...f.owners, { owner_type: 'Colaborador', collaborator_id: collabId }] }));
    }
  };
  const removeOwner = (idx) => setForm(f => ({ ...f, owners: f.owners.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast('El nombre es obligatorio', 'error');
    setSaving(true);
    try {
      if (modal === 'create') { await createProject(form); toast('Proyecto creado'); }
      else { await updateProject(modal, form); toast('Proyecto actualizado'); }
      setModal(null); load();
    } catch (e) { toast(e.message, 'error'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    try { await deleteProject(deleteId); toast('Proyecto eliminado'); setDeleteId(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const filteredProjects = projects.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.client_name?.toLowerCase().includes(search.toLowerCase()) || p.comments?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus ||
      (filterStatus === 'Pendientes'
        ? (p.status === 'Falta Cotizar' || p.status === 'Falta OC')
        : p.status === filterStatus);
    const matchRazon  = !filterRazon  || p.razon_social === filterRazon;
    return matchSearch && matchStatus && matchRazon;
  });

  const hasHourCollab = form.owners?.some(o => {
    if (o.owner_type !== 'Colaborador') return false;
    const c = collaborators.find(c => String(c.id) === String(o.collaborator_id));
    return c?.condition === 'Contratado por horas';
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Proyectos</h2>
          <p>{projects.length} proyectos en total</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={14} /> Nuevo Proyecto
        </button>
      </div>

      <div className="filters-bar">
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proyecto, cliente o comentarios..." style={{ paddingLeft: 32, width: 240 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 160 }}>
          <option value="">Todos los estados</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterRazon} onChange={e => setFilterRazon(e.target.value)} style={{ width: 140 }}>
          <option value="">Todas las RS</option>
          {RAZONES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(search || filterStatus || filterRazon) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterStatus(''); setFilterRazon(''); }}>
            Limpiar
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {filteredProjects.length} resultados
        </span>
      </div>

      <div className="table-wrapper">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
        ) : filteredProjects.length === 0 ? (
          <EmptyState icon="projects" title="Sin proyectos" subtitle="Crea tu primer proyecto con el botón de arriba" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th><th>Cliente</th><th>Estado</th><th>Razón Social</th>
                <th>Tipo</th><th>IVA</th><th>Total USD</th><th>Total UYU</th><th>Factura</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map(p => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/projects/${p.id}`} style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>
                      {p.name}
                    </Link>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.client_name || '—'}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>{p.razon_social ? <RazonBadge razon={p.razon_social} /> : '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{p.type || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                    {p.iva_rate !== null && p.iva_rate !== undefined ? `${Math.round(p.iva_rate * 100)}%` : '—'}
                  </td>
                  <td className="td-mono">{p.total_usd > 0 ? fmtUSD(p.total_usd) : '—'}</td>
                  <td className="td-mono">{p.total_uyu > 0 ? fmtUYU(p.total_uyu) : '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(p.billing_date)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-icon" onClick={() => navigate(`/projects/${p.id}`)}>
                        <Icon name="eye" size={14} />
                      </button>
                      <button className="btn btn-ghost btn-icon" onClick={() => openEdit(p)}>
                        <Icon name="edit" size={14} />
                      </button>
                      <button className="btn btn-ghost btn-icon" style={{ color: 'var(--red)' }} onClick={() => setDeleteId(p.id)}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Project Modal */}
      {modal !== null && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Nuevo Proyecto' : 'Editar Proyecto'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-section-title">Información General</div>

                <div className="form-group full-width">
                  <label>Nombre del Proyecto *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre del proyecto" />
                </div>

                <div className="form-group">
                  <label>Estado</label>
                  <select value={form.status} onChange={e => set('status', e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Cliente</label>
                  <select value={form.client_id} onChange={e => { set('client_id', e.target.value); set('requestor', ''); }}>
                    <option value="">Sin cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Solicitante: dropdown from client referentes */}
                <div className="form-group">
                  <label>Solicitante</label>
                  {referentes.length > 0 ? (
                    <select value={form.requestor} onChange={e => set('requestor', e.target.value)}>
                      <option value="">Seleccionar referente</option>
                      {referentes.map((r, i) => (
                        <option key={i} value={r.name}>{r.name}{r.email ? ` — ${r.email}` : ''}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.requestor}
                      onChange={e => set('requestor', e.target.value)}
                      placeholder={form.client_id ? 'El cliente no tiene referentes' : 'Seleccioná un cliente primero'}
                    />
                  )}
                </div>

                <div className="form-group">
                  <label>PO (Orden de Compra)</label>
                  <input value={form.po} onChange={e => set('po', e.target.value)} placeholder="Número de OC" />
                </div>

                <div className="form-group">
                  <label>Tipo de Proyecto</label>
                  <select value={form.type} onChange={e => set('type', e.target.value)}>
                    <option value="">Seleccionar tipo</option>
                    {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {form.type === 'Tiempo y materiales' && (
                  <div className="form-group">
                    <label>Horas estimadas</label>
                    <input type="number" value={form.hours_estimated} onChange={e => set('hours_estimated', e.target.value)} placeholder="0" />
                  </div>
                )}

                {/* Owners */}
                <div className="form-section-title">Owners del Proyecto</div>
                <div className="form-group full-width">
                  <label>Agregar Owner</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addOwner('Z2')}>
                      + Z2 (Empresa)
                    </button>
                    <select style={{ width: 'auto' }} onChange={e => { if (e.target.value) { addOwner('Colaborador', e.target.value); e.target.value = ''; } }}>
                      <option value="">+ Agregar colaborador...</option>
                      {collaborators.map(c => <option key={c.id} value={c.id}>{c.name} ({c.condition})</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {form.owners.map((o, i) => {
                      const name = o.owner_type === 'Z2' ? 'Z2 (Empresa)'
                        : collaborators.find(c => String(c.id) === String(o.collaborator_id))?.name || 'Colaborador';
                      return (
                        <span key={i} className="badge badge-facturado" style={{ cursor: 'pointer', paddingRight: 4 }}>
                          {name}
                          <button type="button" onClick={() => removeOwner(i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: 4, padding: 0, lineHeight: 1 }}>×</button>
                        </span>
                      );
                    })}
                    {form.owners.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sin owners asignados</span>}
                  </div>
                </div>

                {/* Billing */}
                <div className="form-section-title">Facturación</div>

                <div className="form-group">
                  <label>Razón Social</label>
                  <select value={form.razon_social} onChange={e => set('razon_social', e.target.value)}>
                    <option value="">Seleccionar</option>
                    {RAZONES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Número de Factura</label>
                  <input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="Nro. de factura" />
                </div>

                <div className="form-group">
                  <label>Moneda</label>
                  <select value={form.currency} onChange={e => set('currency', e.target.value)}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {form.currency === 'USD' && (
                  <div className="form-group">
                    <label>Cotización USD al facturar <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(UYU por USD)</span></label>
                    <input type="number" step="0.01" value={form.dolar_at_billing}
                      onChange={e => set('dolar_at_billing', e.target.value)}
                      placeholder="Ej: 43.50" />
                  </div>
                )}

                <div className="form-group">
                  <label>IVA</label>
                  <select value={form.iva_rate} onChange={e => setAndRecalc('iva_rate', parseFloat(e.target.value))}>
                    {IVA_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Fecha de Facturación</label>
                  <input type="date" value={form.billing_date} onChange={e => setBillingDate(e.target.value)} />
                </div>

                {/* USD amounts */}
                <div className="form-section-title">Montos USD</div>
                <div className="form-group">
                  <label>Subtotal USD</label>
                  <input type="number" step="0.01" value={form.subtotal_usd}
                    onChange={e => setAndRecalc('subtotal_usd', e.target.value)} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>IVA USD ({Math.round((form.iva_rate || 0) * 100)}%)</label>
                  <input type="number" step="0.01" value={form.iva_usd} readOnly
                    style={{ opacity: 0.7, cursor: 'not-allowed' }} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Total USD</label>
                  <input type="number" step="0.01" value={form.total_usd} readOnly
                    style={{ opacity: 0.7, cursor: 'not-allowed' }} placeholder="0.00" />
                </div>

                {/* UYU amounts */}
                <div className="form-section-title">Montos UYU</div>
                <div className="form-group">
                  <label>Subtotal UYU</label>
                  <input type="number" step="0.01" value={form.subtotal_uyu}
                    onChange={e => setAndRecalc('subtotal_uyu', e.target.value)} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>IVA UYU ({Math.round((form.iva_rate || 0) * 100)}%)</label>
                  <input type="number" step="0.01" value={form.iva_uyu} readOnly
                    style={{ opacity: 0.7, cursor: 'not-allowed' }} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Total UYU</label>
                  <input type="number" step="0.01" value={form.total_uyu} readOnly
                    style={{ opacity: 0.7, cursor: 'not-allowed' }} placeholder="0.00" />
                </div>

                {/* Payment dates */}
                <div className="form-section-title">Cobro</div>
                <div className="form-group">
                  <label>Fecha posible de cobro <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(auto: factura +30d)</span></label>
                  <input type="date" value={form.possible_payment_date}
                    onChange={e => set('possible_payment_date', e.target.value)}
                    disabled={form.status !== 'Facturado' || !form.billing_date}
                    style={{ opacity: (form.status !== 'Facturado' || !form.billing_date) ? 0.4 : 1 }} />
                </div>
                <div className="form-group">
                  <label>Fecha de cobro efectivo</label>
                  <input type="date" value={form.actual_payment_date}
                    onChange={e => set('actual_payment_date', e.target.value)}
                    disabled={form.status !== 'Cobrado'}
                    style={{ opacity: form.status !== 'Cobrado' ? 0.4 : 1 }} />
                </div>

                {/* Comments */}
                <div className="form-section-title">Comentarios</div>
                <div className="form-group">
                  <textarea value={form.comments} onChange={e => set('comments', e.target.value)}
                    placeholder="Notas u observaciones del proyecto..."
                    rows={3} style={{ resize: 'vertical' }} />
                </div>
              </div>

              {form.razon_social === 'Ingeuy' && form.billing_date && (
                <div className="alert alert-info" style={{ marginTop: 16 }}>
                  <Icon name="info" size={16} />
                  Se generará automáticamente un egreso para Diego Ricca (Socio) por el subtotal al guardar.
                </div>
              )}
              {hasHourCollab && (
                <div className="alert alert-warning" style={{ marginTop: 8 }}>
                  <Icon name="clock" size={16} />
                  Este proyecto tiene colaboradores contratados por horas. Podrás registrar sus horas desde el detalle.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size={14} /> : <Icon name="check" size={14} />}
                {modal === 'create' ? 'Crear Proyecto' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          message="Se eliminará el proyecto y todos sus datos asociados."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
