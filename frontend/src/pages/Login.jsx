import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Icon, Spinner } from '../components/UI';

export default function Login() {
  const { signIn }   = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]     = useState({ username: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) { setError('Completá usuario y contraseña'); return; }
    setLoading(true); setError('');
    try {
      const data = await login(form);
      signIn(data.token, { username: data.username, role: data.role });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* Background grid texture */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(88,166,255,0.06) 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }} />

      <div style={{
        width: '100%', maxWidth: 380, position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, background: 'var(--accent-dim)',
            border: '1px solid rgba(88,166,255,0.3)',
            borderRadius: 14, marginBottom: 16,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>Z2</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Gestión Empresarial
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Zoonotic · Ingeuy</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 24, color: 'var(--text-primary)' }}>
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Usuario</label>
              <input
                autoFocus
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="admin"
                autoComplete="username"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label>Contraseña</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                <Icon name="alert" size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 0', fontSize: 14 }}
              disabled={loading}
            >
              {loading ? <Spinner size={16} /> : <Icon name="zap" size={14} />}
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
          Acceso restringido — solo administrador
        </p>
      </div>
    </div>
  );
}
