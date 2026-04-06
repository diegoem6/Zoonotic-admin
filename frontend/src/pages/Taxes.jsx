import React, { useState, useEffect } from 'react';
import { getTaxes, saveTax, getIvaCalc } from '../utils/api';
import { fmtUYU, fmtUSD, MONTHS, currentYear, currentMonth, YEARS_RANGE } from '../utils/helpers';
import { Icon, RazonBadge, Spinner, toast } from '../components/UI';

const EMPTY_TAX = { iva: '', irae: '', patrimonio: '', bps: '', notes: '', iva_manual_override: false };

// Coeficiente IRAE según mes de pago
const iraeCoef = (paymentMonth) => [1, 2, 3].includes(paymentMonth) ? 0.0218 : 0.0178;

export default function Taxes() {
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(currentYear);
  const [editingKey, setEditingKey] = useState(null); // `${month}-${razon}`
  const [editForm, setEditForm] = useState(EMPTY_TAX);
  const [saving, setSaving] = useState(false);
  const [ivaCalc, setIvaCalc] = useState({});

  const load = async () => {
    setLoading(true);
    const data = await getTaxes({ year });
    setTaxes(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [year]);

  const getRecord = (month, razon) =>
    taxes.find(t => t.month === month && t.year === year && t.razon_social === razon);

  const openEdit = async (month, razon) => {
    const existing = getRecord(month, razon);
    setEditForm(existing ? {
      iva: existing.iva || '',
      irae: existing.irae || '',
      patrimonio: existing.patrimonio || '',
      bps: existing.bps || '',
      notes: existing.notes || '',
      iva_manual_override: existing.iva_manual_override || false
    } : { ...EMPTY_TAX });
    setEditingKey(`${month}-${razon}`);

    // Fetch auto IVA calculation from previous month (IVA generado en mes M se paga en mes M+1)
    const ivaMonth = month === 1 ? 12 : month - 1;
    const ivaYear  = month === 1 ? year - 1 : year;
    try {
      const calc = await getIvaCalc({ month: ivaMonth, year: ivaYear, razon_social: razon });
      setIvaCalc(prev => ({ ...prev, [`${month}-${razon}`]: calc }));
      // If not manually overridden, auto-fill IVA
      const coef = iraeCoef(month);
      const subtotalUYU = parseFloat(calc.total_subtotal_uyu || 0);
      const iraeCalc = (subtotalUYU * coef).toFixed(2);
      setEditForm(f => ({
        ...f,
        ...(!existing?.iva_manual_override ? { iva: parseFloat(calc.total_iva_uyu || 0).toFixed(2) } : {}),
        irae: iraeCalc,
      }));
    } catch {}
  };

  const handleSave = async (month, razon) => {
    setSaving(true);
    try {
      await saveTax({ month, year, razon_social: razon, ...editForm });
      toast('Guardado');
      setEditingKey(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
    setSaving(false);
  };

  const razones = ['Zoonotic', 'Ingeuy'];

  const totalByRazon = (razon) => {
    const rows = taxes.filter(t => t.razon_social === razon && t.year === year);
    return {
      iva: rows.reduce((a, t) => a + parseFloat(t.iva || 0), 0),
      irae: rows.reduce((a, t) => a + parseFloat(t.irae || 0), 0),
      patrimonio: rows.reduce((a, t) => a + parseFloat(t.patrimonio || 0), 0),
      bps: rows.reduce((a, t) => a + parseFloat(t.bps || 0), 0),
      total: rows.reduce((a, t) => a + parseFloat(t.iva || 0) + parseFloat(t.irae || 0) + parseFloat(t.patrimonio || 0) + parseFloat(t.bps || 0), 0),
    };
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Aportes / Impuestos</h2>
          <p>IVA, IRAE, Patrimonio y BPS por razón social</p>
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 110 }}>
          {YEARS_RANGE().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {razones.map(razon => {
          const t = totalByRazon(razon);
          return (
            <div key={razon} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>Total {year}</div>
                <RazonBadge razon={razon} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[['IVA', t.iva], ['IRAE', t.irae], ['Patrimonio', t.patrimonio], ['BPS', t.bps]].map(([k, v]) => (
                  <div key={k} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{k}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtUYU(v)}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>TOTAL</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--red)' }}>{fmtUYU(t.total)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table for each company */}
      {razones.map(razon => (
        <div key={razon} style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>{razon}</h3>
            <RazonBadge razon={razon} />
          </div>

          {loading ? <div style={{ padding: 24, textAlign: 'center' }}><Spinner /></div> : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>IVA (UYU)</th>
                    <th>IRAE (UYU)</th>
                    <th>Patrimonio (UYU)</th>
                    <th>BPS (UYU)</th>
                    <th>Total</th>
                    <th>Notas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((monthName, i) => {
                    const m = i + 1;
                    const rec = getRecord(m, razon);
                    const key = `${m}-${razon}`;
                    const isEditing = editingKey === key;
                    const total = rec ? parseFloat(rec.iva || 0) + parseFloat(rec.irae || 0) + parseFloat(rec.patrimonio || 0) + parseFloat(rec.bps || 0) : 0;
                    const calcKey = ivaCalc[key];
                    const isPast = year < currentYear || (year === currentYear && m <= currentMonth);

                    return (
                      <tr key={m} style={{ opacity: !isPast ? 0.5 : 1 }}>
                        <td style={{ fontWeight: 500 }}>{monthName}</td>
                        {isEditing ? (
                          <>
                            <td>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input type="number" step="0.01" value={editForm.iva}
                                  onChange={e => setEditForm(f => ({ ...f, iva: e.target.value, iva_manual_override: true }))}
                                  style={{ width: 110 }} />
                                {calcKey && (
                                  <button type="button" className="btn btn-ghost btn-icon" title={`Auto: ${fmtUYU(calcKey.total_iva_uyu)}`}
                                    onClick={() => setEditForm(f => ({ ...f, iva: parseFloat(calcKey.total_iva_uyu || 0).toFixed(2), iva_manual_override: false }))}>
                                    <Icon name="refresh" size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td><input type="number" step="0.01" value={editForm.irae} onChange={e => setEditForm(f => ({ ...f, irae: e.target.value }))} style={{ width: 110 }} /></td>
                            <td><input type="number" step="0.01" value={editForm.patrimonio} onChange={e => setEditForm(f => ({ ...f, patrimonio: e.target.value }))} style={{ width: 110 }} /></td>
                            <td><input type="number" step="0.01" value={editForm.bps} onChange={e => setEditForm(f => ({ ...f, bps: e.target.value }))} style={{ width: 110 }} /></td>
                            <td className="td-mono">—</td>
                            <td><input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas..." style={{ width: 120 }} /></td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-primary btn-sm" onClick={() => handleSave(m, razon)} disabled={saving}>
                                  {saving ? <Spinner size={12} /> : 'Guardar'}
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setEditingKey(null)}>✕</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="td-mono">{rec ? fmtUYU(rec.iva) : '—'}{rec?.iva_manual_override ? <span style={{ color: 'var(--yellow)', fontSize: 10 }}>*</span> : ''}</td>
                            <td className="td-mono">{rec ? fmtUYU(rec.irae) : '—'}</td>
                            <td className="td-mono">{rec ? fmtUYU(rec.patrimonio) : '—'}</td>
                            <td className="td-mono">{rec ? fmtUYU(rec.bps) : '—'}</td>
                            <td className="td-mono" style={{ fontWeight: 600, color: total > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{total > 0 ? fmtUYU(total) : '—'}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rec?.notes || '—'}</td>
                            <td>
                              {isPast && (
                                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m, razon)}>
                                  <Icon name="edit" size={13} /> {rec ? 'Editar' : 'Ingresar'}
                                </button>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      <div className="alert alert-info">
        <Icon name="info" size={14} />
        * El IVA se calcula automáticamente desde los proyectos facturados en el mes. Podés editarlo manualmente (marcado con *).
      </div>
    </div>
  );
}
