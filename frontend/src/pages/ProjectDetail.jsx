import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getProject, getProjectHours, addProjectHours, deleteProjectHours,
  getProjectViaticos, addProjectViatico, deleteProjectViatico,
  uploadQuote, uploadInvoice, getCollaborators
} from '../utils/api';
import { fmtUSD, fmtUYU, fmtDate, fmtNum } from '../utils/helpers';
import { Icon, StatusBadge, RazonBadge, CurrencyBadge, ConditionBadge, LoadingPage, ConfirmDialog, toast } from '../components/UI';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [hours, setHours] = useState({ entries: [], totals: [] });
  const [viaticos, setViaticos] = useState({ entries: [], totals: [] });
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingHours, setAddingHours] = useState(false);
  const [hourForm, setHourForm] = useState({ collaborator_id: '', hours: '', date: '', description: '', hourly_rate: '', currency: 'USD' });
  const [savingHours, setSavingHours] = useState(false);
  const [deleteHourId, setDeleteHourId] = useState(null);
  const [addingViatico, setAddingViatico] = useState(false);
  const [viaticForm, setViaticForm] = useState({ collaborator_id: '', dias: '', date: '', description: '', daily_rate: '', currency: 'USD' });
  const [savingViatico, setSavingViatico] = useState(false);
  const [deleteViaticId, setDeleteViaticId] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, h, v, c] = await Promise.all([getProject(id), getProjectHours(id), getProjectViaticos(id), getCollaborators()]);
      setProject(p);
      setHours(h);
      setViaticos(v);
      setCollaborators(c);
    } catch (e) { toast(e.message, 'error'); navigate('/projects'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <LoadingPage />;
  if (!project) return null;

  const hourCollabs = (project.owners || [])
    .filter(o => o.owner_type === 'Colaborador')
    .map(o => collaborators.find(c => c.id == o.collaborator_id))
    .filter(c => c?.condition === 'Contratado por horas');

  const handleAddHours = async () => {
    if (!hourForm.collaborator_id || !hourForm.hours) return toast('Colaborador y horas son obligatorios', 'error');
    setSavingHours(true);
    try {
      await addProjectHours(id, hourForm);
      toast('Horas registradas');
      setHourForm({ collaborator_id: '', hours: '', date: '', description: '', hourly_rate: '', currency: 'USD' });
      setAddingHours(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
    setSavingHours(false);
  };

  const handleDeleteHours = async () => {
    try { await deleteProjectHours(id, deleteHourId); toast('Horas eliminadas'); setDeleteHourId(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const handleAddViatico = async () => {
    if (!viaticForm.collaborator_id || !viaticForm.dias) return toast('Colaborador y días son obligatorios', 'error');
    setSavingViatico(true);
    try {
      await addProjectViatico(id, viaticForm);
      toast('Viático registrado');
      setViaticForm({ collaborator_id: '', dias: '', date: '', description: '', daily_rate: '', currency: 'USD' });
      setAddingViatico(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
    setSavingViatico(false);
  };

  const handleDeleteViatico = async () => {
    try { await deleteProjectViatico(id, deleteViaticId); toast('Viático eliminado'); setDeleteViaticId(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFile(true);
    try { await uploadQuote(id, file); toast('Cotización subida'); load(); }
    catch (e) { toast(e.message, 'error'); }
    setUploadingFile(false);
  };

  const handleInvoiceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingInvoice(true);
    try { await uploadInvoice(id, file); toast('Factura subida'); load(); }
    catch (e) { toast(e.message, 'error'); }
    setUploadingInvoice(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>
            <Icon name="chevronRight" size={14} style={{ transform: 'rotate(180deg)' }} /> Volver
          </button>
          <div>
            <h2>{project.name}</h2>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
              <StatusBadge status={project.status} />
              {project.razon_social && <RazonBadge razon={project.razon_social} />}
              {project.currency && <CurrencyBadge currency={project.currency} />}
              {project.type && <span className="badge badge-neutral">{project.type}</span>}
            </div>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/projects', { state: { editId: Number(id) } })}>
          <Icon name="edit" size={14} />
          Editar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Main info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Details card */}
          <div className="card">
            <div className="card-title">Información General</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                ['Cliente', project.client_name || '—'],
                ['Solicitante', project.requestor || '—'],
                ['PO (OC)', project.po || '—'],
                ['Nro. Factura', project.invoice_number || '—'],
                ['Fecha Facturación', fmtDate(project.billing_date)],
                ['Fecha posible cobro', fmtDate(project.possible_payment_date)],
                ['Fecha cobro efectivo', fmtDate(project.actual_payment_date)],
                ...(project.type === 'Tiempo y materiales' ? [['Horas estimadas', project.hours_estimated ? fmtNum(project.hours_estimated, 0) + ' hs' : '—']] : []),
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          {project.comments && (
            <div className="card">
              <div className="card-title">Comentarios</div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{project.comments}</p>
            </div>
          )}

          {/* Owners */}
          <div className="card">
            <div className="card-title">Owners</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(project.owners || []).map((o, i) => (
                <div key={i} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{o.owner_type === 'Z2' ? 'Z2 (Empresa)' : o.collaborator_name || '—'}</div>
                  {o.collaborator_condition && <ConditionBadge condition={o.collaborator_condition} />}
                </div>
              ))}
              {(!project.owners || project.owners.length === 0) && (
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin owners asignados</span>
              )}
            </div>
          </div>

          {/* Hours tracking (only if has hour-based collaborators) */}
          {hourCollabs.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>Horas Ejecutadas</div>
                <button className="btn btn-primary btn-sm" onClick={() => setAddingHours(true)}>
                  <Icon name="plus" size={12} /> Registrar Horas
                </button>
              </div>

              {/* Totals per collaborator */}
              {hours.totals.length > 0 && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  {hours.totals.map(t => (
                    <div key={t.collaborator_id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t.collaborator_name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{fmtNum(t.total_hours, 1)} hs</div>
                      {parseFloat(t.total_cost_usd) > 0 && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{fmtUSD(t.total_cost_usd)}</div>
                      )}
                      {parseFloat(t.total_cost_uyu) > 0 && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{fmtUYU(t.total_cost_uyu)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Horas</th>
                      <th>Valor/h</th>
                      <th>Total</th>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {hours.entries.map(h => {
                      const total = h.hourly_rate ? parseFloat(h.hours) * parseFloat(h.hourly_rate) : null;
                      return (
                        <tr key={h.id}>
                          <td style={{ fontWeight: 500 }}>{h.collaborator_name}</td>
                          <td className="td-mono" style={{ color: 'var(--accent)' }}>{fmtNum(h.hours, 1)} hs</td>
                          <td className="td-mono" style={{ color: 'var(--text-secondary)' }}>
                            {h.hourly_rate ? `${fmtNum(h.hourly_rate, 2)} ${h.currency}` : '—'}
                          </td>
                          <td className="td-mono" style={{ fontWeight: 600 }}>
                            {total !== null ? (h.currency === 'UYU' ? fmtUYU(total) : fmtUSD(total)) : '—'}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(h.date)}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{h.description || '—'}</td>
                          <td>
                            <div className="row-actions">
                              <button className="btn btn-ghost btn-icon" style={{ color: 'var(--red)' }} onClick={() => setDeleteHourId(h.id)}>
                                <Icon name="trash" size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {hours.entries.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Sin horas registradas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Viaticos (only if has hour-based collaborators) */}
          {hourCollabs.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>Viáticos</div>
                <button className="btn btn-primary btn-sm" onClick={() => setAddingViatico(true)}>
                  <Icon name="plus" size={12} /> Registrar Viático
                </button>
              </div>

              {viaticos.totals.length > 0 && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  {viaticos.totals.map(t => (
                    <div key={t.collaborator_id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t.collaborator_name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{fmtNum(t.total_dias, 1)} días</div>
                      {parseFloat(t.total_cost_usd) > 0 && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{fmtUSD(t.total_cost_usd)}</div>
                      )}
                      {parseFloat(t.total_cost_uyu) > 0 && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{fmtUYU(t.total_cost_uyu)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Días</th>
                      <th>Valor/día</th>
                      <th>Total</th>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {viaticos.entries.map(v => {
                      const total = v.daily_rate ? parseFloat(v.dias) * parseFloat(v.daily_rate) : null;
                      return (
                        <tr key={v.id}>
                          <td style={{ fontWeight: 500 }}>{v.collaborator_name}</td>
                          <td className="td-mono" style={{ color: 'var(--accent)' }}>{fmtNum(v.dias, 1)} días</td>
                          <td className="td-mono" style={{ color: 'var(--text-secondary)' }}>
                            {v.daily_rate ? `${fmtNum(v.daily_rate, 2)} ${v.currency}` : '—'}
                          </td>
                          <td className="td-mono" style={{ fontWeight: 600 }}>
                            {total !== null ? (v.currency === 'UYU' ? fmtUYU(total) : fmtUSD(total)) : '—'}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(v.date)}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{v.description || '—'}</td>
                          <td>
                            <div className="row-actions">
                              <button className="btn btn-ghost btn-icon" style={{ color: 'var(--red)' }} onClick={() => setDeleteViaticId(v.id)}>
                                <Icon name="trash" size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {viaticos.entries.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Sin viáticos registrados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quote file */}
          <div className="card">
            <div className="card-title">Cotización (PDF)</div>
            {project.quote_file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <a href={project.quote_file} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                  <Icon name="file" size={14} /> Ver Cotización
                </a>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF adjunto</span>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin cotización adjunta</div>
            )}
            <div style={{ marginTop: 12 }}>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <Icon name="upload" size={14} /> {uploadingFile ? 'Subiendo...' : 'Subir PDF'}
                <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploadingFile} />
              </label>
            </div>
          </div>

          {/* Invoice file */}
          <div className="card">
            <div className="card-title">Factura (PDF)</div>
            {project.invoice_file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <a href={project.invoice_file} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                  <Icon name="file" size={14} /> Ver Factura
                </a>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF adjunto</span>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin factura adjunta</div>
            )}
            <div style={{ marginTop: 12 }}>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <Icon name="upload" size={14} /> {uploadingInvoice ? 'Subiendo...' : 'Subir PDF'}
                <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleInvoiceUpload} disabled={uploadingInvoice} />
              </label>
            </div>
          </div>
        </div>

        {/* Right sidebar: amounts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title">Montos USD</div>
            {[['Subtotal', project.subtotal_usd], ['IVA', project.iva_usd], ['Total', project.total_usd]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: k !== 'Total' ? '1px solid var(--border-subtle)' : 'none' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{k}</span>
                <span className="td-mono" style={{ fontWeight: k === 'Total' ? 700 : 400, color: k === 'Total' ? 'var(--green)' : 'var(--text-primary)' }}>
                  {fmtUSD(v)}
                </span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Montos UYU</div>
            {[['Subtotal', project.subtotal_uyu], ['IVA', project.iva_uyu], ['Total', project.total_uyu]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: k !== 'Total' ? '1px solid var(--border-subtle)' : 'none' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{k}</span>
                <span className="td-mono" style={{ fontWeight: k === 'Total' ? 700 : 400, color: k === 'Total' ? 'var(--green)' : 'var(--text-primary)' }}>
                  {fmtUYU(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Hours Modal */}
      {addingHours && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3>Registrar Horas</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setAddingHours(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-group">
                  <label>Colaborador *</label>
                  <select value={hourForm.collaborator_id} onChange={e => setHourForm(f => ({ ...f, collaborator_id: e.target.value }))}>
                    <option value="">Seleccionar colaborador</option>
                    {hourCollabs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Horas *</label>
                  <input type="number" step="0.5" min="0" value={hourForm.hours} onChange={e => setHourForm(f => ({ ...f, hours: e.target.value }))} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Valor hora</label>
                  <input type="number" step="0.01" min="0" value={hourForm.hourly_rate} onChange={e => setHourForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Moneda</label>
                  <select value={hourForm.currency} onChange={e => setHourForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="USD">USD</option>
                    <option value="UYU">UYU</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha</label>
                  <input type="date" value={hourForm.date} onChange={e => setHourForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Descripción</label>
                  <textarea value={hourForm.description} onChange={e => setHourForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción de las tareas..." rows={3} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAddingHours(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAddHours} disabled={savingHours}>
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteHourId && (
        <ConfirmDialog message="Se eliminarán estas horas registradas." onConfirm={handleDeleteHours} onCancel={() => setDeleteHourId(null)} />
      )}

      {/* Add Viatico Modal */}
      {addingViatico && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3>Registrar Viático</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setAddingViatico(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-group">
                  <label>Colaborador *</label>
                  <select value={viaticForm.collaborator_id} onChange={e => setViaticForm(f => ({ ...f, collaborator_id: e.target.value }))}>
                    <option value="">Seleccionar colaborador</option>
                    {hourCollabs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Cantidad de días *</label>
                  <input type="number" step="0.5" min="0" value={viaticForm.dias} onChange={e => setViaticForm(f => ({ ...f, dias: e.target.value }))} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Valor por día</label>
                  <input type="number" step="0.01" min="0" value={viaticForm.daily_rate} onChange={e => setViaticForm(f => ({ ...f, daily_rate: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Moneda</label>
                  <select value={viaticForm.currency} onChange={e => setViaticForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="USD">USD</option>
                    <option value="UYU">UYU</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha</label>
                  <input type="date" value={viaticForm.date} onChange={e => setViaticForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Descripción</label>
                  <textarea value={viaticForm.description} onChange={e => setViaticForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción del viático..." rows={3} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAddingViatico(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAddViatico} disabled={savingViatico}>
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteViaticId && (
        <ConfirmDialog message="Se eliminará este viático registrado." onConfirm={handleDeleteViatico} onCancel={() => setDeleteViaticId(null)} />
      )}
    </div>
  );
}
