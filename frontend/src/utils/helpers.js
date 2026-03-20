// Currency formatters
export const fmtUSD = (n) =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);

export const fmtUYU = (n) =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', minimumFractionDigits: 2 }).format(n || 0);

export const fmtNum = (n, decimals = 2) =>
  new Intl.NumberFormat('es-UY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n || 0);

// Date formatters
export const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

export const fmtMonthYear = (month, year) => {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' });
};

export const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

export const currentYear = new Date().getFullYear();
export const currentMonth = new Date().getMonth() + 1;

// Status config
export const STATUS_CONFIG = {
  'Cobrado':       { className: 'badge-cobrado',  label: 'Cobrado' },
  'Falta Cotizar': { className: 'badge-cotizar',  label: 'Falta Cotizar' },
  'Falta OC':      { className: 'badge-oc',       label: 'Falta OC' },
  'Facturado':     { className: 'badge-facturado', label: 'Facturado' },
  'En Ejecución':  { className: 'badge-ejecucion', label: 'En Ejecución' },
};

export const STATUSES = Object.keys(STATUS_CONFIG);

export const CONDITION_CONFIG = {
  'Empleado':            { className: 'badge-facturado', label: 'Empleado' },
  'Contratado por horas':{ className: 'badge-cotizar',   label: 'Contratado x hs' },
  'Coparticipante':      { className: 'badge-ejecucion', label: 'Coparticipante' },
  'Socio':               { className: 'badge-oc',        label: 'Socio' },
};

export const RAZONES = ['Zoonotic', 'Ingeuy'];
export const CURRENCIES = ['USD', 'UYU'];
export const CONDITIONS = ['Empleado', 'Contratado por horas', 'Coparticipante', 'Socio'];
export const PROJECT_TYPES = ['Tiempo y materiales', 'Proyecto cerrado'];
export const EXPENSE_TYPES = ['Egreso', 'Devolución'];

export const YEARS_RANGE = () => {
  const y = currentYear;
  return [y - 2, y - 1, y, y + 1];
};

// Summarize numbers for stat cards
export const abbrevNum = (n) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
};
