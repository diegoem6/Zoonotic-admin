import React, { useState, useEffect, useCallback } from 'react';
import { getCollaborators, getCollaborator, createCollaborator, updateCollaborator, deleteCollaborator } from '../utils/api';
import { fmtDate, fmtNum, CONDITIONS } from '../utils/helpers';
import { Icon, ConditionBadge, ConfirmDialog, Spinner, EmptyState, StatusBadge, toast } from '../components/UI';
import { Link } from 'react-router-dom';

const EMPTY = { name: '', start_date: '', email: '', condition: 'Empleado', active: true };

export default function Collaborators() {
  const [collabs, setCollabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getCollaborators();
    setCollabs(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    setDetailId(id);
    setLoadingDetail(true);
    const data = await getCollaborator(id);
    setDetail(data);
    setLoadingDetail(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit = (c) => {
    setForm({ ...c, start_date: c.start_date ? c.start_date.split('T')[0] : '' });
    setModal(c.id);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast('El nombre es obligatorio', 'error');
    setSaving(true);
    try {
      if (modal === 'create') { await createCollaborator(form); toast('Colaborador creado'); }
      else { await updateCollaborator(modal, form); toast('Colaborador actualizado'); }
      setModal(null); load();
    } catch (e) { toast(e.message, 'error'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    try { await deleteCollaborator(deleteId); toast('Colaborador eliminado'); setDeleteId(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const grouped = CONDITIONS.reduce((acc, cond) => {
    acc[cond] = collabs.filter(c => c.condition === cond);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Colaboradores</h2>
          <p>{collabs.length} colaboradores registrados</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={14} /> Nuevo Colaborador
        </button>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> :
        collabs.length === 0 ? <EmptyState icon="collaborators" title="Sin colaboradores" subtitle="Agrega tu primer colaborador" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {CONDITIONS.filter(cond => grouped[cond].length > 0).map(cond => (
              <div key={cond}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                  {cond} ({grouped[cond].length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {grouped[cond].map(c => (
                    <div key={c.id} className="card" style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
                      onClick={() => openDetail(c.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{c.name}</div>
                          <ConditionBadge condition={c.condition} />
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon" onClick={e => { e.stopPropagation(); openEdit(c); }}><Icon name="edit" size={13} /></button>
                          <button className="btn btn-ghost btn-icon" style={{ color: 'var(--red)' }} onClick={e => { e.stopPropagation(); setDeleteId(c.id); }}><Icon name="trash" size={13} /></button>
                        </div>
                      </div>
                      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {c.email && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="externalLink" size={11} />{c.email}</div>}
                        {c.start_date && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="calendar" size={11} />Desde {fmtDate(c.start_date)}</div>}
                        {!c.active && <span className="badge badge-neutral" style={{ width: 'fit-content' }}>Inactivo</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Create/Edit Modal */}
      {modal !== null && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Nuevo Colaborador' : 'Editar Colaborador'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-group">
                  <label>Nombre *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre completo" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@ejemplo.com" />
                </div>
                <div className="form-group">
                  <label>Condición *</label>
                  <select value={form.condition} onChange={e => set('condition', e.target.value)}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha de Alta</label>
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                </div>
                {modal !== 'create' && (
                  <div className="form-group">
                    <label>Estado</label>
                    <select value={form.active ? 'true' : 'false'} onChange={e => set('active', e.target.value === 'true')}>
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size={14} /> : null}
                {modal === 'create' ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailId && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>{loadingDetail ? 'Cargando...' : detail?.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => { setDetailId(null); setDetail(null); }}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              {loadingDetail ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div> : detail && (
                <div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                    <div className="stat-card" style={{ flex: '1 1 180px' }}>
                      <div className="stat-label">Condición</div>
                      <div style={{ marginTop: 8 }}><ConditionBadge condition={detail.condition} /></div>
                    </div>
                    <div className="stat-card" style={{ flex: '1 1 180px' }}>
                      <div className="stat-label">Alta</div>
                      <div className="stat-value" style={{ fontSize: 16 }}>{fmtDate(detail.start_date)}</div>
                    </div>
                    <div className="stat-card" style={{ flex: '1 1 180px' }}>
                      <div className="stat-label">Proyectos</div>
                      <div className="stat-value">{detail.projects?.length || 0}</div>
                    </div>
                  </div>

                  {detail.email && (
                    <div className="alert alert-info" style={{ marginBottom: 16 }}>
                      <Icon name="externalLink" size={14} />
                      <a href={`mailto:${detail.email}`} style={{ color: 'inherit' }}>{detail.email}</a>
                    </div>
                  )}

                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
                    Proyectos asignados
                  </div>

                  {detail.projects?.length > 0 ? (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr><th>Proyecto</th><th>Estado</th><th>Razón Social</th><th>Hs Ejecutadas</th><th>Factura</th></tr>
                        </thead>
                        <tbody>
                          {detail.projects.map(p => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 500 }}>{p.name}</td>
                              <td><StatusBadge status={p.status} /></td>
                              <td>{p.razon_social || '—'}</td>
                              <td className="td-mono" style={{ color: 'var(--accent)' }}>
                                {parseFloat(p.total_hours_executed) > 0 ? fmtNum(p.total_hours_executed, 1) + ' hs' : '—'}
                              </td>
                              <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(p.billing_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>Sin proyectos asignados</div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setDetailId(null); setDetail(null); }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && <ConfirmDialog message="Se eliminará el colaborador." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
