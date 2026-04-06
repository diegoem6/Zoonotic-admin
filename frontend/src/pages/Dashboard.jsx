import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, getBillingSummary, getExpenses } from '../utils/api';
import { fmtUSD, fmtUYU, fmtDate, MONTHS, currentMonth, currentYear } from '../utils/helpers';
import { Icon, LoadingPage, RazonBadge, StatusBadge } from '../components/UI';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [billing, setBilling] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getProjects(),
      getBillingSummary({ year: currentYear }),
      getExpenses()
    ]).then(([p, b, e]) => {
      setProjects(p);
      setBilling(b);
      setExpenses(e);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingPage />;

  const active = projects.filter(p => p.status === 'En Ejecución').length;
  const pending = projects.filter(p => p.status === 'Falta Cotizar' || p.status === 'Falta OC').length;
  const invoiced = projects.filter(p => p.status === 'Facturado').length;

  // Current month billing
  const thisMonthBilling = billing.filter(b => b.month === currentMonth && b.year === currentYear);
  const totalUSDThisMonth = thisMonthBilling.reduce((a, b) => a + parseFloat(b.total_usd || 0), 0);
  const totalUYUThisMonth = thisMonthBilling.reduce((a, b) => a + parseFloat(b.total_uyu || 0), 0);

  // Total expenses this month
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
  });
  const expUSD = thisMonthExpenses.filter(e => e.currency === 'USD' && e.type === 'Egreso').reduce((a, e) => a + parseFloat(e.amount), 0);
  const expUYU = thisMonthExpenses.filter(e => e.currency === 'UYU' && e.type === 'Egreso').reduce((a, e) => a + parseFloat(e.amount), 0);

  // Chart data: last 6 months
  const chartData = Array.from({ length: 6 }, (_, i) => {
    let m = currentMonth - 5 + i;
    let y = currentYear;
    if (m <= 0) { m += 12; y -= 1; }
    const monthBilling = billing.filter(b => b.month === m && b.year === y);
    return {
      name: MONTHS[m - 1].slice(0, 3),
      Zoonotic: monthBilling.filter(b => b.razon_social === 'Zoonotic').reduce((a, b) => a + parseFloat(b.subtotal_usd || 0), 0),
      Ingeuy: monthBilling.filter(b => b.razon_social === 'Ingeuy').reduce((a, b) => a + parseFloat(b.subtotal_usd || 0), 0),
    };
  });

  const recentProjects = [...projects].slice(0, 8);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Resumen general — {MONTHS[currentMonth - 1]} {currentYear}</p>
        </div>
        <Link to="/projects" state={{ openCreate: true }} className="btn btn-primary">
          <Icon name="plus" size={14} /> Nuevo Proyecto
        </Link>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <Link to="/projects" state={{ filterStatus: 'En Ejecución' }} className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="stat-label">Proyectos activos</div>
          <div className="stat-value" style={{ color: 'var(--teal)' }}>{active}</div>
          <div className="stat-sub">En Ejecución</div>
        </Link>
        <Link to="/projects" state={{ filterStatus: 'Pendientes' }} className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="stat-label">Pendientes</div>
          <div className="stat-value" style={{ color: 'var(--yellow)' }}>{pending}</div>
          <div className="stat-sub">Falta Cotizar / OC</div>
        </Link>
        <div className="stat-card">
          <div className="stat-label">Facturado (este mes)</div>
          <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 18 }}>{fmtUSD(totalUSDThisMonth)}</div>
          <div className="stat-sub">{fmtUYU(totalUYUThisMonth)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Egresos (este mes)</div>
          <div className="stat-value" style={{ color: 'var(--red)', fontSize: 18 }}>{fmtUSD(expUSD)}</div>
          <div className="stat-sub">{fmtUYU(expUYU)}</div>
        </div>
        <Link to="/projects" state={{ filterStatus: 'Facturado' }} className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="stat-label">Facturados sin cobrar</div>
          <div className="stat-value" style={{ color: 'var(--purple)' }}>{invoiced}</div>
          <div className="stat-sub">Proyectos facturados</div>
        </Link>
        <div className="stat-card">
          <div className="stat-label">Total proyectos</div>
          <div className="stat-value">{projects.length}</div>
          <div className="stat-sub">Histórico</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card mb-6" style={{ marginBottom: 24 }}>
        <div className="card-title">Facturación últimos 6 meses (USD subtotal)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(v, name) => [fmtUSD(v), name]}
            />
            <Bar dataKey="Zoonotic" fill="var(--teal)" radius={[4,4,0,0]} />
            <Bar dataKey="Ingeuy" fill="var(--purple)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--teal)' }}>■ Zoonotic</span>
          <span style={{ color: 'var(--purple)' }}>■ Ingeuy</span>
        </div>
      </div>

      {/* Recent projects */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Proyectos recientes</h3>
          <Link to="/projects" className="btn btn-ghost btn-sm">Ver todos →</Link>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Razón Social</th>
                <th>Total USD</th>
                <th>Fecha Factura</th>
              </tr>
            </thead>
            <tbody>
              {recentProjects.map(p => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/projects/${p.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                      {p.name}
                    </Link>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.client_name || '—'}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>{p.razon_social ? <RazonBadge razon={p.razon_social} /> : '—'}</td>
                  <td className="td-mono">{p.total_usd > 0 ? fmtUSD(p.total_usd) : '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(p.billing_date)}</td>
                </tr>
              ))}
              {recentProjects.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Sin proyectos aún</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
