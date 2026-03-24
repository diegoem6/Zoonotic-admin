import React, { useState, useEffect, useCallback } from 'react';
import {
  getPayments, createPayment, updatePayment, deletePayment,
  getPendingExpenses, getPaymentExpensesForEdit, uploadPaymentReceipt,
  getCollaborators,
} from '../utils/api';
import { fmtUSD, fmtUYU, fmtDate, CURRENCIES } from '../utils/helpers';
import { Icon, CurrencyBadge, ConfirmDialog, Spinner, EmptyState, toast } from '../components/UI';

const fmt = (amount, currency) => currency === 'USD' ? fmtUSD(amount) : fmtUYU(amount);
const EMPTY_FORM = { date: '', currency: 'USD', collaborator_id: '', notes: '' };

export default function Payments() {
  const [payments, setPayments]               = useState([]);
  const [collaborators, setCollaborators]     = useState([]);
  const [loading, setLoading]                 = useState(true);
  // modal: null = cerrado | 'create' | payment object = editando
  const [modal, setModal]                     = useState(null);
  const [form, setForm]                       = useState(EMPTY_FORM);
  const [pendingExpenses, setPendingExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [allocations, setAllocations]         = useState({});
  const [saving, setSaving]                   = useState(false);
  const [deleteId, setDeleteId]               = useState(null);

  const isEdit = modal !== null && modal !== 'create';

  // Cuando editamos, guardamos colaborador/moneda originales para saber si cambiaron
  const originalKey = isEdit ? `${modal.collaborator_id}_${modal.currency}` : null;

  const load = useCallback(async () => {
    setLoading(true);
    const [p, c] = await Promise.all([getPayments(), getCollaborators()]);
    setPayments(p); setCollaborators(c);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Cargar egresos cuando cambia colaborador, moneda o el modal
  useEffect(() => {
    if (!modal || !form.collaborator_id || !form.currency) {
      setPendingExpenses([]); setAllocations({}); return;
    }

    setLoadingExpenses(true);
    const currentKey = `${form.collaborator_id}_${form.currency}`;
    const useEditEndpoint = isEdit && currentKey === originalKey;

    const request = useEditEndpoint
      ? getPaymentExpensesForEdit(modal.id)
      : getPendingExpenses({ collaborator_id: form.collaborator_id, currency: form.currency });

    request
      .then(data => {
        setPendingExpenses(data);
        if (useEditEndpoint) {
          // Pre-rellenar asignaciones con los valores existentes del pago
          const allocs = {};
          data.forEach(e => {
            if (parseFloat(e.this_payment_allocation) > 0) {
              allocs[e.id] = String(parseFloat(e.this_payment_allocation));
            }
          });
          setAllocations(allocs);
        } else {
          setAllocations({});
        }
      })
      .catch(() => setPendingExpenses([]))
      .finally(() => setLoadingExpenses(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.collaborator_id, form.currency, modal]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });
    setAllocations({});
    setPendingExpenses([]);
    setModal('create');
  };

  const openEdit = (payment) => {
    setForm({
      date:            payment.date?.split('T')[0] || '',
      currency:        payment.currency,
      collaborator_id: String(payment.collaborator_id || ''),
      notes:           payment.notes || '',
    });
    setAllocations({});
    setPendingExpenses([]);
    setModal(payment);
  };

  const setAlloc = (expenseId, value) =>
    setAllocations(a => ({ ...a, [expenseId]: value }));

  const allocateFull = (expense) => {
    // En edición: "otros pagos" = already_allocated - this_payment_allocation
    const otherAllocated = isEdit
      ? parseFloat(expense.already_allocated || 0) - parseFloat(expense.this_payment_allocation || 0)
      : parseFloat(expense.already_allocated || 0);
    const remaining = parseFloat(expense.amount) - otherAllocated;
    setAlloc(expense.id, remaining > 0 ? String(remaining.toFixed(2)) : '0');
  };

  // El monto total del pago es siempre la suma de las asignaciones
  const totalAllocated = pendingExpenses.reduce((sum, e) => {
    const v = parseFloat(allocations[e.id] || 0);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const handleSave = async () => {
    if (!form.date || !form.collaborator_id || !form.currency) {
      return toast('Fecha, colaborador y moneda son obligatorios', 'error');
    }
    const items = pendingExpenses
      .filter(e => parseFloat(allocations[e.id] || 0) > 0)
      .map(e => ({ expense_id: e.id, amount: parseFloat(allocations[e.id]) }));
    if (items.length === 0) return toast('Asigná al menos un monto a un egreso', 'error');

    setSaving(true);
    try {
      const payload = { ...form, amount: totalAllocated, items };
      if (isEdit) {
        await updatePayment(modal.id, payload);
        toast('Pago actualizado');
      } else {
        await createPayment(payload);
        toast('Pago registrado');
      }
      setModal(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await deletePayment(deleteId);
      toast('Pago eliminado');
      setDeleteId(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleReceiptUpload = async (paymentId, file) => {
    try {
      await uploadPaymentReceipt(paymentId, file);
      toast('Comprobante subido');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const totalUSD = payments.filter(p => p.currency === 'USD').reduce((a, p) => a + parseFloat(p.amount || 0), 0);
  const totalUYU = payments.filter(p => p.currency === 'UYU').reduce((a, p) => a + parseFloat(p.amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Pagos a Colaboradores</h2>
          <p>{payments.length} pagos registrados</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={14} /> Nuevo Pago
        </button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Pagado USD</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--red)' }}>{fmtUSD(totalUSD)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Pagado UYU</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--red)' }}>{fmtUYU(totalUYU)}</div>
        </div>
      </div>

      <div className="table-wrapper">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
        ) : payments.length === 0 ? (
          <EmptyState icon="expenses" title="Sin pagos" subtitle="Registrá el primer pago con el botón de arriba" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Colaborador</th>
                <th>Monto</th>
                <th>Moneda</th>
                <th>Egresos cubiertos</th>
                <th>Notas</th>
                <th>Comprobante</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(p.date)}</td>
                  <td style={{ fontWeight: 500 }}>{p.collaborator_name || '—'}</td>
                  <td className="td-mono" style={{ color: 'var(--red)' }}>{fmt(p.amount, p.currency)}</td>
                  <td><CurrencyBadge currency={p.currency} /></td>
                  <td>
                    {p.item_count > 0
                      ? <span className="badge badge-cobrado">{p.item_count} egreso{p.item_count !== 1 ? 's' : ''}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.notes || '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.receipt_file && (
                        <a href={p.receipt_file} target="_blank" rel="noopener noreferrer"
                          className="btn btn-ghost btn-icon" title="Ver comprobante">
                          <Icon name="file" size={14} />
                        </a>
                      )}
                      <label className="btn btn-ghost btn-icon" title="Subir comprobante" style={{ cursor: 'pointer' }}>
                        <Icon name="upload" size={14} />
                        <input type="file" style={{ display: 'none' }}
                          onChange={ev => { if (ev.target.files[0]) handleReceiptUpload(p.id, ev.target.files[0]); ev.target.value = ''; }} />
                      </label>
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-icon" onClick={() => openEdit(p)} title="Editar">
                        <Icon name="edit" size={14} />
                      </button>
                      <button className="btn btn-ghost btn-icon" style={{ color: 'var(--red)' }}
                        onClick={() => setDeleteId(p.id)} title="Eliminar">
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

      {/* Modal crear / editar */}
      {modal !== null && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 660 }}>
            <div className="modal-header">
              <h3>{isEdit ? 'Editar Pago' : 'Nuevo Pago'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group">
                  <label>Fecha *</label>
                  <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Moneda *</label>
                  <select value={form.currency} onChange={e => set('currency', e.target.value)}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Colaborador *</label>
                  <select value={form.collaborator_id} onChange={e => set('collaborator_id', e.target.value)}>
                    <option value="">Seleccionar colaborador...</option>
                    {collaborators.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Notas</label>
                  <input value={form.notes} onChange={e => set('notes', e.target.value)}
                    placeholder="Referencia, observación..." />
                </div>
              </div>

              {/* Tabla de egresos */}
              {form.collaborator_id && form.currency && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--text-primary)' }}>
                    Egresos pendientes en {form.currency}
                    {isEdit && ` (incluye los asignados a este pago)`}
                  </div>

                  {loadingExpenses ? (
                    <div style={{ padding: 16, textAlign: 'center' }}><Spinner /></div>
                  ) : pendingExpenses.length === 0 ? (
                    <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13,
                      background: 'var(--bg-elevated)', borderRadius: 6 }}>
                      No hay egresos pendientes en {form.currency} para este colaborador.
                    </div>
                  ) : (
                    <div className="table-wrapper" style={{ marginBottom: 0 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Descripción</th>
                            <th>Monto</th>
                            <th>Otros pagos</th>
                            <th>Asignar en este pago</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingExpenses.map(e => {
                            const otherAllocated = isEdit
                              ? parseFloat(e.already_allocated || 0) - parseFloat(e.this_payment_allocation || 0)
                              : parseFloat(e.already_allocated || 0);
                            const remaining = parseFloat(e.amount) - otherAllocated;
                            return (
                              <tr key={e.id}>
                                <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                  {fmtDate(e.date)}
                                </td>
                                <td style={{ fontSize: 12, maxWidth: 160 }}>{e.description}</td>
                                <td className="td-mono" style={{ color: 'var(--red)', fontSize: 12 }}>
                                  {fmt(e.amount, e.currency)}
                                </td>
                                <td className="td-mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                                  {otherAllocated > 0 ? fmt(otherAllocated, e.currency) : '—'}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input
                                      type="number" step="0.01" min="0" max={remaining}
                                      value={allocations[e.id] || ''}
                                      onChange={ev => setAlloc(e.id, ev.target.value)}
                                      placeholder="0.00"
                                      style={{ width: 90, fontSize: 12 }}
                                    />
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      style={{ fontSize: 11, padding: '2px 8px', whiteSpace: 'nowrap' }}
                                      onClick={() => allocateFull(e)}
                                    >
                                      Todo
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {totalAllocated > 0 && (
                    <div style={{
                      marginTop: 12, padding: '8px 12px',
                      background: 'var(--bg-elevated)', borderRadius: 6, fontSize: 13,
                      display: 'flex', justifyContent: 'space-between',
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Monto del pago:</span>
                      <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>
                        {fmt(totalAllocated, form.currency)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size={14} /> : null}
                {isEdit ? 'Guardar Cambios' : 'Registrar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          message="Se eliminará el pago. Los egresos que queden sin cubrir volverán a estado pendiente."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
