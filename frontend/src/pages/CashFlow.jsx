import React, { useState, useEffect } from 'react';
import { getCashflow } from '../utils/api';
import { fmtUSD, fmtUYU, MONTHS, currentYear, YEARS_RANGE } from '../utils/helpers';
import { Icon, LoadingPage } from '../components/UI';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function CashFlow() {
  const [data, setData]         = useState(null);
  const [year, setYear]         = useState(currentYear);
  const [loading, setLoading]   = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [selectedCollab, setSelectedCollab] = useState('all');

  useEffect(() => {
    setLoading(true);
    getCashflow({ year }).then(setData).finally(() => setLoading(false));
  }, [year]);

  if (loading || !data) return <LoadingPage />;

  const k   = currency === 'USD' ? 'usd' : 'uyu';
  const fmt = currency === 'USD' ? fmtUSD : fmtUYU;

  // Build one row per month
  const monthlyRows = MONTHS.map((name, i) => {
    const m = i + 1;

    // COBROS efectivos (actual_payment_date)
    const cobrosZoo = data.cobros
      .filter(r => r.month === m && r.year === Number(year) && r.razon_social === 'Zoonotic')
      .reduce((a, r) => a + parseFloat(r[`total_${k}`] || 0), 0);

    const cobrosIng = data.cobros
      .filter(r => r.month === m && r.year === Number(year) && r.razon_social === 'Ingeuy')
      .reduce((a, r) => a + parseFloat(r[`total_${k}`] || 0), 0);

    const totalCobros = cobrosZoo + cobrosIng;

    // Egresos
    const expRow      = data.expenses.find(e => e.month === m && e.year === Number(year));
    const egresos     = parseFloat(expRow?.[`total_${k}`]     || 0);
    const devoluciones = parseFloat(expRow?.[`devolucion_${k}`] || 0);

    // Impuestos (solo UYU; no hay tipo de cambio guardado)
    const taxRows   = data.taxes.filter(t => t.month === m && t.year === Number(year));
    const impuestos = currency === 'UYU'
      ? taxRows.reduce((a, t) => a + parseFloat(t.total || 0), 0)
      : 0;

    const neto = totalCobros - egresos + devoluciones - impuestos;

    return { name, m, cobrosZoo, cobrosIng, totalCobros, egresos, devoluciones, impuestos, neto };
  });

  // Chart
  const chartData = monthlyRows.map(r => ({
    name:    r.name.slice(0, 3),
    Cobros:  r.totalCobros,
    Egresos: r.egresos,
    Neto:    r.neto,
  }));

  const totalCobros    = monthlyRows.reduce((a, r) => a + r.totalCobros, 0);
  const totalEgresos   = monthlyRows.reduce((a, r) => a + r.egresos, 0);
  const totalImpuestos = monthlyRows.reduce((a, r) => a + r.impuestos, 0);
  const totalNeto      = monthlyRows.reduce((a, r) => a + r.neto, 0);
  const totalDev       = monthlyRows.reduce((a, r) => a + r.devoluciones, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Flujo de Caja</h2>
          <p>Cobros efectivos, egresos e impuestos por mes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="tabs" style={{ margin: 0 }}>
            <button className={`tab ${currency === 'USD' ? 'active' : ''}`} onClick={() => setCurrency('USD')}>USD</button>
            <button className={`tab ${currency === 'UYU' ? 'active' : ''}`} onClick={() => setCurrency('UYU')}>UYU</button>
          </div>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 110 }}>
            {YEARS_RANGE().map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Cobrado {year}</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>{fmt(totalCobros)}</div>
          <div className="stat-sub">Cobros efectivos (fecha de cobro)</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Egresos {year}</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--red)' }}>{fmt(totalEgresos)}</div>
        </div>
        {currency === 'UYU' && (
          <div className="stat-card">
            <div className="stat-label">Total Impuestos {year}</div>
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--yellow)' }}>{fmt(totalImpuestos)}</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-label">Neto {year}</div>
          <div className="stat-value" style={{ fontSize: 18, color: totalNeto >= 0 ? 'var(--accent)' : 'var(--red)' }}>{fmt(totalNeto)}</div>
          <div className="stat-sub">Cobrado − Egresos{currency === 'UYU' ? ' − Impuestos' : ''}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Devoluciones {year}</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--teal)' }}>{fmt(totalDev)}</div>
        </div>
      </div>

      {/* Area chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Flujo mensual {year} — {currency} (cobros efectivos)</div>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gCobros"  x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--green)"  stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--green)"  stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gEgresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--red)"    stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--red)"    stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gNeto"    x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => currency === 'USD'
                ? `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`
                : `$U${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`}
            />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(v, name) => [fmt(v), name]}
            />
            <Area type="monotone" dataKey="Cobros"  stroke="var(--green)"  fill="url(#gCobros)"  strokeWidth={2} />
            <Area type="monotone" dataKey="Egresos" stroke="var(--red)"    fill="url(#gEgresos)" strokeWidth={2} />
            <Area type="monotone" dataKey="Neto"    stroke="var(--accent)" fill="url(#gNeto)"    strokeWidth={2} strokeDasharray="5 3" />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--green)' }}>■ Cobros efectivos</span>
          <span style={{ color: 'var(--red)' }}>■ Egresos</span>
          <span style={{ color: 'var(--accent)' }}>— Neto</span>
        </div>
      </div>

      {/* Monthly detail table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Cobros Zoonotic</th>
              <th>Cobros Ingeuy</th>
              <th>Total Cobrado</th>
              <th>Egresos</th>
              <th>Devoluciones</th>
              {currency === 'UYU' && <th>Impuestos</th>}
              <th>Neto</th>
            </tr>
          </thead>
          <tbody>
            {monthlyRows.map(r => {
              const hasData = r.totalCobros > 0 || r.egresos > 0;
              return (
                <tr key={r.m} style={{ opacity: hasData ? 1 : 0.4 }}>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td className="td-mono" style={{ color: 'var(--teal)' }}>
                    {r.cobrosZoo > 0 ? fmt(r.cobrosZoo) : '—'}
                  </td>
                  <td className="td-mono" style={{ color: 'var(--purple)' }}>
                    {r.cobrosIng > 0 ? fmt(r.cobrosIng) : '—'}
                  </td>
                  <td className="td-mono" style={{ fontWeight: 600, color: 'var(--green)' }}>
                    {r.totalCobros > 0 ? fmt(r.totalCobros) : '—'}
                  </td>
                  <td className="td-mono" style={{ color: 'var(--red)' }}>
                    {r.egresos > 0 ? fmt(r.egresos) : '—'}
                  </td>
                  <td className="td-mono" style={{ color: 'var(--green)' }}>
                    {r.devoluciones > 0 ? fmt(r.devoluciones) : '—'}
                  </td>
                  {currency === 'UYU' && (
                    <td className="td-mono" style={{ color: 'var(--yellow)' }}>
                      {r.impuestos > 0 ? fmt(r.impuestos) : '—'}
                    </td>
                  )}
                  <td className="td-mono" style={{ fontWeight: 700, color: hasData ? (r.neto >= 0 ? 'var(--accent)' : 'var(--red)') : 'var(--text-muted)' }}>
                    {hasData ? fmt(r.neto) : '—'}
                  </td>
                </tr>
              );
            })}

            {/* Totals row */}
            <tr className="total-row">
              <td>TOTAL {year}</td>
              <td className="td-mono">{fmt(monthlyRows.reduce((a, r) => a + r.cobrosZoo, 0))}</td>
              <td className="td-mono">{fmt(monthlyRows.reduce((a, r) => a + r.cobrosIng, 0))}</td>
              <td className="td-mono" style={{ color: 'var(--green)' }}>{fmt(totalCobros)}</td>
              <td className="td-mono" style={{ color: 'var(--red)' }}>{fmt(totalEgresos)}</td>
              <td className="td-mono">{fmt(totalDev)}</td>
              {currency === 'UYU' && <td className="td-mono" style={{ color: 'var(--yellow)' }}>{fmt(totalImpuestos)}</td>}
              <td className="td-mono" style={{ color: totalNeto >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(totalNeto)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Egresos por colaborador — tabla cruzada */}
      {(() => {
        const collabMap = {};
        (data.collab_expenses || []).forEach(r => {
          if (!collabMap[r.collaborator_id]) collabMap[r.collaborator_id] = r.collaborator_name;
        });
        const allCollabIds = Object.keys(collabMap).sort((a, b) => collabMap[a].localeCompare(collabMap[b]));
        if (allCollabIds.length === 0) return null;

        const collabIds = selectedCollab === 'all'
          ? allCollabIds
          : allCollabIds.filter(id => id === selectedCollab);

        // Build lookup: collabId_month -> { egreso, devolucion }
        const lookup = {};
        (data.collab_expenses || []).forEach(r => {
          if (r.currency !== currency) return;
          const key = `${r.collaborator_id}_${r.month}`;
          if (!lookup[key]) lookup[key] = { egreso: 0, devolucion: 0 };
          lookup[key].egreso     += parseFloat(r.total_egreso     || 0);
          lookup[key].devolucion += parseFloat(r.total_devolucion || 0);
        });

        const getCell = (cid, month) => lookup[`${cid}_${month}`] || { egreso: 0, devolucion: 0 };

        // Column totals
        const colTotals = collabIds.map(cid => {
          const egreso     = MONTHS.reduce((a, _, i) => a + getCell(cid, i + 1).egreso, 0);
          const devolucion = MONTHS.reduce((a, _, i) => a + getCell(cid, i + 1).devolucion, 0);
          return { egreso, devolucion };
        });

        return (
          <div className="card" style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Egresos por colaborador — {year} ({currency})</div>
              <select value={selectedCollab} onChange={e => setSelectedCollab(e.target.value)} style={{ width: 180 }}>
                <option value="all">Todos los colaboradores</option>
                {allCollabIds.map(id => (
                  <option key={id} value={id}>{collabMap[id]}</option>
                ))}
              </select>
            </div>
            <div className="table-wrapper" style={{ marginTop: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    {collabIds.map(cid => (
                      <th key={cid} colSpan={2} style={{ textAlign: 'center' }}>{collabMap[cid]}</th>
                    ))}
                  </tr>
                  <tr>
                    <th></th>
                    {collabIds.map(cid => (
                      <React.Fragment key={cid}>
                        <th style={{ color: 'var(--red)', fontSize: 11 }}>Egreso</th>
                        <th style={{ color: 'var(--green)', fontSize: 11 }}>Devolución</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((name, i) => {
                    const m = i + 1;
                    const cells = collabIds.map(cid => getCell(cid, m));
                    const hasData = cells.some(c => c.egreso > 0 || c.devolucion > 0);
                    return (
                      <tr key={m} style={{ opacity: hasData ? 1 : 0.4 }}>
                        <td style={{ fontWeight: 500 }}>{name}</td>
                        {cells.map((c, idx) => (
                          <React.Fragment key={collabIds[idx]}>
                            <td className="td-mono" style={{ color: 'var(--red)' }}>
                              {c.egreso > 0 ? fmt(c.egreso) : '—'}
                            </td>
                            <td className="td-mono" style={{ color: 'var(--green)' }}>
                              {c.devolucion > 0 ? fmt(c.devolucion) : '—'}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    );
                  })}
                  <tr className="total-row">
                    <td>TOTAL {year}</td>
                    {colTotals.map((t, idx) => (
                      <React.Fragment key={collabIds[idx]}>
                        <td className="td-mono" style={{ color: 'var(--red)' }}>{fmt(t.egreso)}</td>
                        <td className="td-mono" style={{ color: 'var(--green)' }}>{fmt(t.devolucion)}</td>
                      </React.Fragment>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}


      {currency === 'USD' && (
        <div className="alert alert-warning" style={{ marginTop: 16 }}>
          <Icon name="info" size={14} />
          Los impuestos (IVA, IRAE, Patrimonio, BPS) están en UYU. Cambiá a modo UYU para incluirlos en el neto.
        </div>
      )}

      <div className="alert alert-info" style={{ marginTop: 8 }}>
        <Icon name="calendar" size={14} />
        El flujo refleja únicamente los <strong>cobros efectivos</strong> (fecha de cobro real), no la fecha de facturación.
        Los proyectos sin fecha de cobro no aparecen en este informe.
      </div>
    </div>
  );
}
