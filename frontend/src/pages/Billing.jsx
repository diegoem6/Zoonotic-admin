import React, { useState, useEffect } from 'react';
import { getBillingSummary, getBillingCombined } from '../utils/api';
import { fmtUSD, fmtUYU, fmtNum, MONTHS, currentYear, YEARS_RANGE } from '../utils/helpers';
import { Icon, LoadingPage, RazonBadge } from '../components/UI';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const MONTH_NAMES = MONTHS.map(m => m.slice(0, 3));

export default function Billing() {
  const [summary, setSummary] = useState([]);
  const [combined, setCombined] = useState([]);
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('combined');
  const [filterRazon, setFilterRazon] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getBillingSummary({ year }),
      getBillingCombined({ year })
    ]).then(([s, c]) => {
      setSummary(s);
      setCombined(c);
    }).finally(() => setLoading(false));
  }, [year]);

  if (loading) return <LoadingPage />;

  const displayData = activeTab === 'combined'
    ? combined
    : summary.filter(r => !filterRazon || r.razon_social === filterRazon);

  // Build chart data for all 12 months
  const chartData = MONTHS.map((name, i) => {
    const m = i + 1;
    const zoo = summary.find(r => r.month === m && r.razon_social === 'Zoonotic');
    const ing = summary.find(r => r.month === m && r.razon_social === 'Ingeuy');
    return {
      name: name.slice(0, 3),
      Zoonotic: parseFloat(zoo?.subtotal_usd || 0),
      Ingeuy: parseFloat(ing?.subtotal_usd || 0),
    };
  });

  // Totals
  const totalUSD = displayData.reduce((a, r) => a + parseFloat(r.total_usd || 0), 0);
  const totalUYU = displayData.reduce((a, r) => a + parseFloat(r.total_uyu || 0), 0);
  const subtotalUSD = displayData.reduce((a, r) => a + parseFloat(r.subtotal_usd || 0), 0);
  const ivaUSD = displayData.reduce((a, r) => a + parseFloat(r.iva_usd || 0), 0);
  const subtotalUYU = displayData.reduce((a, r) => a + parseFloat(r.subtotal_uyu || 0), 0);
  const ivaUYU = displayData.reduce((a, r) => a + parseFloat(r.iva_uyu || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Resumen de Facturación</h2>
          <p>Facturación por mes y razón social</p>
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 110 }}>
          {YEARS_RANGE().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Subtotal USD {year}</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>{fmtUSD(subtotalUSD)}</div>
          <div className="stat-sub">IVA: {fmtUSD(ivaUSD)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total USD {year}</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>{fmtUSD(totalUSD)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Subtotal UYU {year}</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>{fmtUYU(subtotalUYU)}</div>
          <div className="stat-sub">IVA: {fmtUYU(ivaUYU)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total UYU {year}</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>{fmtUYU(totalUYU)}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card mb-6" style={{ marginBottom: 24 }}>
        <div className="card-title">Facturación mensual {year} (USD subtotal)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
            <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v, name) => [fmtUSD(v), name]} />
            <Bar dataKey="Zoonotic" fill="var(--teal)" radius={[4,4,0,0]} />
            <Bar dataKey="Ingeuy" fill="var(--purple)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--teal)' }}>■ Zoonotic</span>
          <span style={{ color: 'var(--purple)' }}>■ Ingeuy</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="tabs">
          <button className={`tab ${activeTab === 'combined' ? 'active' : ''}`} onClick={() => setActiveTab('combined')}>Combinado</button>
          <button className={`tab ${activeTab === 'byCompany' ? 'active' : ''}`} onClick={() => setActiveTab('byCompany')}>Por Empresa</button>
        </div>
        {activeTab === 'byCompany' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn btn-sm ${filterRazon === '' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterRazon('')}>Todas</button>
            <button className={`btn btn-sm ${filterRazon === 'Zoonotic' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterRazon('Zoonotic')}>Zoonotic</button>
            <button className={`btn btn-sm ${filterRazon === 'Ingeuy' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterRazon('Ingeuy')}>Ingeuy</button>
          </div>
        )}
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {activeTab === 'byCompany' && <th>Empresa</th>}
              <th>Mes</th>
              <th>Proyectos</th>
              <th>Subtotal USD</th>
              <th>IVA USD</th>
              <th>Total USD</th>
              <th>Subtotal UYU</th>
              <th>IVA UYU</th>
              <th>Total UYU</th>
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Sin datos para el período seleccionado</td></tr>
            ) : displayData.map((r, i) => (
              <tr key={i}>
                {activeTab === 'byCompany' && <td><RazonBadge razon={r.razon_social} /></td>}
                <td style={{ fontWeight: 500 }}>{MONTHS[(r.month || 1) - 1]} {r.year}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{r.project_count}</td>
                <td className="td-mono">{fmtUSD(r.subtotal_usd)}</td>
                <td className="td-mono" style={{ color: 'var(--text-muted)' }}>{fmtUSD(r.iva_usd)}</td>
                <td className="td-mono" style={{ fontWeight: 600, color: 'var(--green)' }}>{fmtUSD(r.total_usd)}</td>
                <td className="td-mono">{fmtUYU(r.subtotal_uyu)}</td>
                <td className="td-mono" style={{ color: 'var(--text-muted)' }}>{fmtUYU(r.iva_uyu)}</td>
                <td className="td-mono" style={{ fontWeight: 600, color: 'var(--green)' }}>{fmtUYU(r.total_uyu)}</td>
              </tr>
            ))}
            {displayData.length > 0 && (
              <tr className="total-row">
                {activeTab === 'byCompany' && <td>—</td>}
                <td>TOTAL</td>
                <td>{displayData.reduce((a, r) => a + parseInt(r.project_count || 0), 0)}</td>
                <td className="td-mono">{fmtUSD(subtotalUSD)}</td>
                <td className="td-mono">{fmtUSD(ivaUSD)}</td>
                <td className="td-mono" style={{ color: 'var(--green)' }}>{fmtUSD(totalUSD)}</td>
                <td className="td-mono">{fmtUYU(subtotalUYU)}</td>
                <td className="td-mono">{fmtUYU(ivaUYU)}</td>
                <td className="td-mono" style={{ color: 'var(--green)' }}>{fmtUYU(totalUYU)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
