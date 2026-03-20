# Z2 — Sistema de Gestión Empresarial

Aplicación de administración para **Zoonotic / Ingeuy**. Stack: React + Vite (frontend), Node.js + Express (backend), PostgreSQL (base de datos).

---

## 🗂 Estructura

```
app/
├── backend/               # Node.js + Express API
│   ├── routes/
│   │   ├── clients.js
│   │   ├── collaborators.js
│   │   ├── projects.js    # incluye lógica de egreso automático Ingeuy
│   │   ├── expenses.js
│   │   ├── taxes.js
│   │   ├── billing.js
│   │   └── cashflow.js
│   ├── schema.sql         # Esquema completo de la BD
│   ├── server.js
│   ├── db.js
│   └── .env.example
├── frontend/              # React + Vite
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── Projects.jsx
│       │   ├── ProjectDetail.jsx
│       │   ├── Clients.jsx
│       │   ├── Collaborators.jsx
│       │   ├── Billing.jsx
│       │   ├── Expenses.jsx
│       │   ├── Taxes.jsx
│       │   └── CashFlow.jsx
│       ├── components/
│       │   ├── UI.jsx       # Componentes reutilizables + iconos + toast
│       │   └── Layout.jsx   # Sidebar + topbar
│       └── utils/
│           ├── api.js       # Todas las llamadas HTTP
│           └── helpers.js   # Formatters, constantes
└── docker-compose.yml
```

---

## 🚀 Inicio rápido (Docker)

```bash
# Clonar y entrar al directorio
cd app

# Levantar todo (BD + backend + frontend)
docker-compose up -d

# La app estará en: http://localhost:5173
# El backend en:    http://localhost:4000
```

---

## 🛠 Desarrollo local (sin Docker)

### 1. PostgreSQL

Crear base de datos:
```sql
CREATE DATABASE empresa_db;
```

Aplicar el esquema:
```bash
psql -U postgres -d empresa_db -f backend/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL
npm install
npm run dev   # Inicia en http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev   # Inicia en http://localhost:5173
```

---

## ✅ Funcionalidades

### Proyectos
- CRUD completo de proyectos
- Estados: Cobrado, Falta Cotizar, Falta OC, Facturado, En Ejecución
- Owners: Z2 (empresa) + colaboradores
- Tipos: Tiempo y materiales / Proyecto cerrado
- Registro de horas ejecutadas por colaboradores contratados por horas
- Subida de PDF de cotización
- Montos en USD y UYU con cálculo automático de totales
- **Egreso automático Ingeuy**: Al facturar un proyecto con razón social "Ingeuy", se genera automáticamente un egreso a nombre del colaborador "Diego Ricca (Socio)" por el subtotal

### Clientes
- CRUD con RUT, descripción y referentes (nombre + email + teléfono)

### Colaboradores
- Condiciones: Empleado, Contratado por horas, Coparticipante, Socio
- Vista de proyectos asignados y horas ejecutadas históricas

### Resumen de Facturación
- Por mes, por razón social o combinado
- Subtotal, IVA y Total en USD y UYU
- Gráfico de barras mensual

### Egresos
- Manual: fecha, descripción, monto, moneda, colaborador, comentario, tipo (Egreso/Devolución)
- Automáticos: generados por proyectos Ingeuy (no editables manualmente)

### Aportes / Impuestos
- IVA calculado automáticamente desde proyectos facturados (editable)
- IRAE, Patrimonio, BPS por mes y razón social
- Totales anuales por empresa

### Flujo de Caja
- Vista mensual en USD o UYU
- Ingresos por Zoonotic e Ingeuy separados
- Egresos, devoluciones, impuestos (UYU) y cobros efectivos
- Gráfico de área acumulado
- Neto = Facturado − Egresos (− Impuestos en UYU)

---

## ⚙️ Variables de entorno (backend)

```env
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=empresa_db
DB_USER=postgres
DB_PASSWORD=yourpassword
FRONTEND_URL=http://localhost:5173
```

---

## 📝 Notas

- **Diego Ricca**: El sistema busca automáticamente un colaborador con nombre "Diego Ricca" y condición "Socio" para generar egresos automáticos de proyectos Ingeuy. Asegurate de crearlo con ese nombre exacto.
- **IVA automático**: El IVA en Aportes/Impuestos se calcula sumando los campos `iva_uyu` de todos los proyectos facturados en ese mes/razón. Podés sobreescribir el valor manualmente.
- **Horas**: Solo se habilita la sección de registro de horas si el proyecto tiene al menos un colaborador con condición "Contratado por horas" como owner.
