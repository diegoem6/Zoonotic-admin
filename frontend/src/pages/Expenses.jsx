import React, { useState, useEffect, useCallback } from 'react';
import { getExpenses, createExpense, updateExpense, deleteExpense, getCollaborators } from '../utils/api';
import { fmtUSD, fmtUYU, fmtDate, CURRENCIES, EXPENSE_TYPES, MONTHS, currentYear, currentMonth, YEARS_RANGE } from '../utils/helpers';
import { Icon, CurrencyBadge, ConfirmDialog, Spinner, EmptyState, toast } from '../components/UI';

const EMPTY = { date: '', description: '', amount: '', currency: 'USD', collaborator_id: '', comment: '', type: 'Egreso' };

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

  const handleDelete = async () => {
    try { await deleteExpense(deleteId); toast('Egreso eliminado'); setDeleteId(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const filtered = expenses.filter(e => {
    const matchCollab = !filterCollab || String(e.collaborator_id) === filterCollab;
    const matchCurr = !filterCurrency || e.currency === filterCurrency;
    const matchType = !filterType || e.type === filterType;
    return matchCollab && matchCurr && matchType;
  });

  // Totals
  const totalEgresoUSD = filtered.filter(e => e.currency === 'USD' && e.type === 'Egreso').reduce((a, e) => a + parseFloat(e.amount || 0), 0);
  const totalEgresoUYU = filtered.filter(e => e.currency === 'UYU' && e.type === 'Egreso').reduce((a, e) => a + parseFloat(e.amount || 0), 0);
  const totalDevUSD = filtered.filter(e => e.currency === 'USD' && e.type === 'Devolución').reduce((a, e) => a + parseFloat(e.amount || 0), 0);
  const totalDevUYU = filtered.filter(e => e.currency === 'UYU' && e.type === 'Devolución').reduce((a, e) => a + parseFloat(e.amount || 0), 0);

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
          <div className="stat-label">Total Egresos USD</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--red)' }}>{fmtUSD(totalEgresoUSD)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Egresos UYU</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--red)' }}>{fmtUYU(totalEgresoUYU)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Devoluciones USD</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>{fmtUSD(totalDevUSD)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Devoluciones UYU</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>{fmtUYU(totalDevUYU)}</div>
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
        {(filterCollab || filterCurrency || filterType) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterCollab(''); setFilterCurrency(''); setFilterType(''); }}>
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
                <th>Comentario</th>
                <th>Origen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
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
                  <td style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 160 }}>{e.comment || '—'}</td>
                  <td>
                    {e.auto_generated ? (
                      <span className="badge badge-ingeuy">Auto</span>
                    ) : (
                      <span className="badge badge-neutral">Manual</span>
                    )}
                  </td>
                  <td>
                    {!e.auto_generated && (
                      <div className="row-actions">
                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(e)}><Icon name="edit" size={14} /></button>
                        <button className="btn btn-ghost btn-icon" style={{ color: 'var(--red)' }} onClick={() => setDeleteId(e.id)}><Icon name="trash" size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
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
