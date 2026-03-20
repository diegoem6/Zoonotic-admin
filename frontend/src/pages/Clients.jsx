import React, { useState, useEffect, useCallback } from 'react';
import { getClients, createClient, updateClient, deleteClient } from '../utils/api';
import { Icon, ConfirmDialog, Spinner, EmptyState, toast } from '../components/UI';

const EMPTY = { name: '', rut: '', description: '', referentes: [] };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getClients();
    setClients(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit = (c) => { setForm({ ...c, referentes: c.referentes || [] }); setModal(c.id); };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addReferente = () => setForm(f => ({ ...f, referentes: [...(f.referentes || []), { name: '', email: '', phone: '' }] }));
  const updateReferente = (i, k, v) => setForm(f => {
    const refs = [...(f.referentes || [])];
    refs[i] = { ...refs[i], [k]: v };
    return { ...f, referentes: refs };
  });
  const removeReferente = (i) => setForm(f => ({ ...f, referentes: (f.referentes || []).filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast('El nombre es obligatorio', 'error');
    setSaving(true);
    try {
      if (modal === 'create') { await createClient(form); toast('Cliente creado'); }
      else { await updateClient(modal, form); toast('Cliente actualizado'); }
      setModal(null); load();
    } catch (e) { toast(e.message, 'error'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    try { await deleteClient(deleteId); toast('Cliente eliminado'); setDeleteId(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.rut?.includes(search)
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Clientes</h2>
          <p>{clients.length} clientes registrados</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={14} /> Nuevo Cliente
        </button>
      </div>

      <div className="filters-bar">
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o RUT..." style={{ paddingLeft: 32, width: 260 }} />
        </div>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> :
        filtered.length === 0 ? <EmptyState icon="clients" title="Sin clientes" subtitle="Agrega tu primer cliente con el botón de arriba" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(c => (
              <div key={c.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', cursor: 'pointer', gap: 12 }}
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {c.rut && <span style={{ marginRight: 12 }}>RUT: {c.rut}</span>}
                      {c.referentes?.length > 0 && <span>{c.referentes.length} referente{c.referentes.length !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-icon" onClick={e => { e.stopPropagation(); openEdit(c); }}><Icon name="edit" size={14} /></button>
                    <button className="btn btn-ghost btn-icon" style={{ color: 'var(--red)' }} onClick={e => { e.stopPropagation(); setDeleteId(c.id); }}><Icon name="trash" size={14} /></button>
                    <Icon name="chevronDown" size={14} style={{ color: 'var(--text-muted)', transform: expanded === c.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                </div>
                {expanded === c.id && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', background: 'var(--bg-elevated)' }}>
                    {c.description && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Descripción</div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.description}</p>
                      </div>
                    )}
                    {c.referentes?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Referentes</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {c.referentes.map((r, i) => (
                            <div key={i} style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                              <span style={{ fontWeight: 500, minWidth: 160 }}>{r.name}</span>
                              {r.email && <a href={`mailto:${r.email}`} style={{ color: 'var(--accent)' }}>{r.email}</a>}
                              {r.phone && <span style={{ color: 'var(--text-secondary)' }}>{r.phone}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!c.description && (!c.referentes || c.referentes.length === 0) && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin información adicional</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {/* Modal */}
      {modal !== null && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Nombre *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre del cliente" />
                </div>
                <div className="form-group">
                  <label>RUT</label>
                  <input value={form.rut} onChange={e => set('rut', e.target.value)} placeholder="RUT" />
                </div>
                <div className="form-group full-width">
                  <label>Descripción</label>
                  <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descripción del cliente..." />
                </div>

                <div className="form-section-title">Referentes</div>
                <div className="form-group full-width">
                  {(form.referentes || []).map((r, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                      <input value={r.name} onChange={e => updateReferente(i, 'name', e.target.value)} placeholder="Nombre" />
                      <input value={r.email} onChange={e => updateReferente(i, 'email', e.target.value)} placeholder="Email" type="email" />
                      <input value={r.phone} onChange={e => updateReferente(i, 'phone', e.target.value)} placeholder="Teléfono" />
                      <button type="button" className="btn btn-danger btn-icon" onClick={() => removeReferente(i)}>
                        <Icon name="close" size={12} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addReferente}>
                    <Icon name="plus" size={12} /> Agregar Referente
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size={14} /> : <Icon name="check" size={14} />}
                {modal === 'create' ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && <ConfirmDialog message="Se eliminará el cliente." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
