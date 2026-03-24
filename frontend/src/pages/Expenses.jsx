import React, { useState, useEffect, useCallback } from 'react';
import { getExpenses, createExpense, updateExpense, updateExpenseStatus, uploadExpenseReceipt, deleteExpense, getCollaborators } from '../utils/api';
import { fmtUSD, fmtUYU, fmtDate, CURRENCIES, EXPENSE_TYPES } from '../utils/helpers';
import { Icon, CurrencyBadge, ConfirmDialog, Spinner, EmptyState, toast } from '../components/UI';

const EMPTY = { date: '', description: '', amount: '', currency: 'USD', collaborator_id: '', comment: '', type: 'Egreso', payment_status: 'pendiente' };

const PaymentStatusBadge = ({ status }) => (
  <span className={`badge ${status === 'pagado' ? 'badge-cobrado' : 'badge-cotizar'}`}>
    {status === 'pagado' ? 'Pagado' : 'Pendiente'}
  </span>
);

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [filterCollab, setFilterCollab] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [e, c] = await Promise.all([getExpenses(), getCollaborators()]);
    setExpenses(e); setCollaborators(c);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => {
    const today = new Date().toISOString().split('T')[0];
    setForm({ ...EMPTY, date: today });
    setModal('create');
  };
  const openEdit = (e) => {
    setForm({ ...e, date: e.date?.split('T')[0] || '' });
    setModal(e.id);
  };

  const handleSave = async () => {
    if (!form.date || !form.amount) return toast('Fecha y monto son obligatorios', 'error');
    setSaving(true);
    try {
      if (modal === 'create') { await createExpense(form); toast('Egreso registrado'); }
      else { await updateExpense(modal, form); toast('Egreso actualizado'); }
      setModal(null); load();
    } catch (e) { toast(e.message, 'error'); }
    setSaving(false);
  };

  const handleToggleStatus = async (expense) => {
    const next = expense.payment_status === 'pagado' ? 'pendiente' : 'pagado';
    try {
      await updateExpenseStatus(expense.id, next);
      toast(next === 'pagado' ? 'Marcado como pagado' : 'Marcado como pendiente');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleDelete = async () => {
    try { await deleteExpense(deleteId); toast('Egreso eliminado'); setDeleteId(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const handleReceiptUpload = async (expenseId, file) => {
    try { await uploadExpenseReceipt(expenseId, file); toast('Comprobante subido'); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  // Separar egresos parciales (hijos auto-generados) de los principales
  const mainExpenses = expenses.filter(e => !e.is_partial);
  const partialsByParentId = {};
  expenses.filter(e => e.is_partial).forEach(p => {
    if (!partialsByParentId[p.parent_expense_id]) partialsByParentId[p.parent_expense_id] = [];
    partialsByParentId[p.parent_expense_id].push(p);
  });

  // Los filtros se aplican sólo a los egresos principales
  const filtered = mainExpenses.filter(e => {
    const matchCollab = !filterCollab || String(e.collaborator_id) === filterCollab;
    const matchCurr = !filterCurrency || e.currency === filterCurrency;
    const matchType = !filterType || e.type === filterType;
    const matchStatus = !filterStatus || e.payment_status === filterStatus;
    return matchCollab && matchCurr && matchType && matchStatus;
  });

  // Totals: only pagado expenses count as effective
  const pagados = filtered.filter(e => e.payment_status === 'pagado');
  const pendientes = filtered.filter(e => e.payment_status === 'pendiente');
  const totalEgresoUSD = pagados.filter(e => e.currency === 'USD' && e.type === 'Egreso').reduce((a, e) => a + parseFloat(e.amount || 0), 0);
  const totalEgresoUYU = pagados.filter(e => e.currency === 'UYU' && e.type === 'Egreso').reduce((a, e) => a + parseFloat(e.amount || 0), 0);
  const totalPendUSD = pendientes.filter(e => e.currency === 'USD' && e.type === 'Egreso').reduce((a, e) => a + parseFloat(e.amount || 0), 0);
  const totalPendUYU = pendientes.filter(e => e.currency === 'UYU' && e.type === 'Egreso').reduce((a, e) => a + parseFloat(e.amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Egresos</h2>
          <p>{expenses.length} egresos registrados</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={14} /> Nuevo Egreso
        </button>
      </div>

      {/* Summary */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Egresos Pagados USD</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--red)' }}>{fmtUSD(totalEgresoUSD)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Egresos Pagados UYU</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--red)' }}>{fmtUYU(totalEgresoUYU)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pendiente USD</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--text-secondary)' }}>{fmtUSD(totalPendUSD)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pendiente UYU</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--text-secondary)' }}>{fmtUYU(totalPendUYU)}</div>
        </div>
      </div>

      <div className="filters-bar">
        <select value={filterCollab} onChange={e => setFilterCollab(e.target.value)} style={{ width: 180 }}>
          <option value="">Todos los colaboradores</option>
          {collaborators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)} style={{ width: 120 }}>
          <option value="">Moneda</option>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 140 }}>
          <option value="">Todos los tipos</option>
          {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 140 }}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
        </select>
        {(filterCollab || filterCurrency || filterType || filterStatus) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterCollab(''); setFilterCurrency(''); setFilterType(''); setFilterStatus(''); }}>
            Limpiar
          </button>
        )}
      </div>

      <div className="table-wrapper">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="expenses" title="Sin egresos" subtitle="Registra tu primer egreso con el botón de arriba" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Moneda</th>
                <th>Colaborador</th>
                <th>Estado</th>
                <th>Origen</th>
                <th>Comprobante</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <React.Fragment key={e.id}>
                <tr>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</td>
                  <td style={{ fontWeight: 500, maxWidth: 200 }}>{e.description}</td>
                  <td>
                    <span className={`badge ${e.type === 'Devolución' ? 'badge-cobrado' : 'badge-cotizar'}`}>{e.type}</span>
                  </td>
                  <td className="td-mono" style={{ color: e.type === 'Devolución' ? 'var(--green)' : 'var(--red)' }}>
                    {e.currency === 'USD' ? fmtUSD(e.amount) : fmtUYU(e.amount)}
                  </td>
                  <td><CurrencyBadge currency={e.currency} /></td>
                  <td style={{ color: 'var(--text-secondary)' }}>{e.collaborator_name || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 6px' }}
                        onClick={() => handleToggleStatus(e)}
                        title={e.payment_status === 'pagado' ? 'Marcar como pendiente' : 'Marcar como pagado'}
                      >
                        <PaymentStatusBadge status={e.payment_status} />
                      </button>
                      {(partialsByParentId[e.id]?.length > 0) && (
                        <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                          {partialsByParentId[e.id].length} pago{partialsByParentId[e.id].length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {e.auto_generated ? (
                      <span className="badge badge-ingeuy">Auto</span>
                    ) : (
                      <span className="badge badge-neutral">Manual</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {e.receipt_file && (
                        <a href={e.receipt_file} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-icon" title="Ver comprobante">
                          <Icon name="file" size={14} />
                        </a>
                      )}
                      <label className="btn btn-ghost btn-icon" title="Subir comprobante" style={{ cursor: 'pointer' }}>
                        <Icon name="upload" size={14} />
                        <input type="file" style={{ display: 'none' }} onChange={ev => { if (ev.target.files[0]) handleReceiptUpload(e.id, ev.target.files[0]); ev.target.value = ''; }} />
                      </label>
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-icon" onClick={() => openEdit(e)}><Icon name="edit" size={14} /></button>
                      {!e.auto_generated && (
                        <button className="btn btn-ghost btn-icon" style={{ color: 'var(--red)' }} onClick={() => setDeleteId(e.id)}><Icon name="trash" size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
                {(partialsByParentId[e.id] || []).map(p => (
                  <tr key={p.id} style={{ background: 'var(--bg-elevated)', opacity: 0.9 }}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11, paddingLeft: 28, whiteSpace: 'nowrap' }}>
                      └ {fmtDate(p.date)}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: 200 }}>
                      {p.description}
                    </td>
                    <td><span className="badge badge-cobrado" style={{ fontSize: 10 }}>Parcial</span></td>
                    <td className="td-mono" style={{ color: 'var(--green)', fontSize: 12 }}>
                      {p.currency === 'USD' ? fmtUSD(p.amount) : fmtUYU(p.amount)}
                    </td>
                    <td><CurrencyBadge currency={p.currency} /></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{p.collaborator_name || '—'}</td>
                    <td><span className="badge badge-cobrado" style={{ fontSize: 10 }}>Pagado</span></td>
                    <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>Auto</span></td>
                    <td /><td />
                  </tr>
                ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Nuevo Egreso' : 'Editar Egreso'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group">
                  <label>Fecha *</label>
                  <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Tipo</label>
                  <select value={form.type} onChange={e => set('type', e.target.value)}>
                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Descripción</label>
                  <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descripción del egreso" />
                </div>
                <div className="form-group">
                  <label>Monto *</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Moneda</label>
                  <select value={form.currency} onChange={e => set('currency', e.target.value)}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select value={form.payment_status} onChange={e => set('payment_status', e.target.value)}>
                    <option value="pendiente">Pendiente</option>
                    <option value="pagado">Pagado</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Colaborador</label>
                  <select value={form.collaborator_id} onChange={e => set('collaborator_id', e.target.value)}>
                    <option value="">Sin colaborador</option>
                    {collaborators.map(c => <option key={c.id} value={c.id}>{c.name} ({c.condition})</option>)}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Comentario</label>
                  <textarea value={form.comment} onChange={e => set('comment', e.target.value)} placeholder="Comentario opcional..." rows={3} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size={14} /> : null}
                {modal === 'create' ? 'Registrar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && <ConfirmDialog message="Se eliminará este egreso." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
