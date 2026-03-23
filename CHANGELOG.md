# KALLPA GYM SaaS — Documentación de Cambios

> Versión acumulada de las sesiones de desarrollo: 2026-03-11 / 2026-03-12
> Stack: React 18 + TypeScript + Vite + Supabase + Mercado Pago

---

## Resumen ejecutivo

Se agregaron 5 módulos completos al sistema:

| # | Módulo | Ruta | Tipo |
|---|--------|------|------|
| 1 | Pagos online de miembros vía Mercado Pago | Portal + Edge Functions | Feature |
| 2 | Sistema de Clases y Horario | `/classes` | Feature |
| 3 | Reservas de clases (admin + miembro) | `/classes` + portal | Feature |
| 4 | Historial de pagos de miembros | `/payments` | Feature |
| 5 | Página pública del gym | `/g/:slug` | Feature |

---

## 1. Pagos Online de Miembros (Mercado Pago)

### Arquitectura

Cada gym usa su **propio token de Mercado Pago** (`APP_USR-...`). El dinero va directo a la cuenta MP del dueño del gym — Kallpa no intermedia pagos de miembros.

```
Miembro (portal) → create-member-payment (Edge Fn) → MP Checkout
                                                           ↓ (aprobado)
                                          mp-member-webhook (Edge Fn)
                                                           ↓
                                          members.end_date += plan.duration_days
                                          member_payments.insert(...)
```

### Archivos creados

#### `supabase/functions/create-member-payment/index.ts`

Edge Function pública (sin autenticación requerida) que genera una preferencia de pago en MP.

**Flujo:**
1. Recibe `{ memberId, planId }` en el body
2. Busca el `tenant_id` del miembro en la tabla `members`
3. Obtiene el `mp_access_token` del gym desde `gym_settings`
4. Valida que el plan pertenece al mismo gym (seguridad multi-tenant)
5. Crea la preferencia MP con `external_reference = { payment_type: "member_renewal", member_id, plan_id }`
6. Incluye `notification_url` con `?tenant_id=xxx` para que el webhook sepa qué token usar
7. Retorna `{ init_point }` — la URL de checkout de MP

**Back URLs configuradas:**
- Éxito: `/portal/{memberId}?payment=success`
- Fallo: `/portal/{memberId}?payment=failure`
- Pendiente: `/portal/{memberId}?payment=pending`

#### `supabase/functions/mp-member-webhook/index.ts`

Webhook que MP llama cuando un pago es aprobado.

**Flujo:**
1. Extrae `tenant_id` del query param de la URL
2. Obtiene el `mp_access_token` del gym para consultar la API de MP
3. Verifica firma HMAC-SHA256 (si `MP_WEBHOOK_SECRET` está configurado)
4. Consulta el pago a la API de MP — solo procesa si `status = 'approved'`
5. Lee `external_reference` — solo continúa si `payment_type = 'member_renewal'`
6. **Idempotencia:** verifica `member_payments.mp_payment_id = 'MP-MEMBER-{paymentId}'` — si ya existe, retorna OK sin procesar
7. Calcula nueva fecha: `max(hoy, end_date_actual) + plan.duration_days` *(stacking automático)*
8. Actualiza `members.end_date` y `members.status = 'active'`
9. Inserta en `member_payments` con el `mp_payment_id` único

**Manejo de errores:**
- Error 23505 (UNIQUE constraint) en insert → ya fue procesado, OK silencioso
- Cualquier otro error → lanza excepción → MP reintenta → idempotencia protege contra doble extensión

### Archivos modificados

#### `src/pages/Settings.tsx` — Tab "Pagos"

Nueva pestaña dentro de la página de Ajustes para configurar los pagos online.

**Campos añadidos:**
- `mp_access_token` — input tipo password con toggle mostrar/ocultar
- Badge de éxito cuando el token está configurado
- Card explicativa del flujo de 5 pasos

**Función `handleSaveMpToken()`:**
- Guarda `mp_access_token` en `gym_settings` usando `update` por `id` o `upsert` por `tenant_id`
- Separado del `updateSettings` principal para no sobreescribir otros campos accidentalmente

**Estado añadido:**
```typescript
const [mpToken, setMpToken] = useState("");
const [showMpToken, setShowMpToken] = useState(false);
const [savingMpToken, setSavingMpToken] = useState(false);
```

#### `src/pages/PortalMiembro.tsx` — Tab "Renovar"

Cuarto tab en el portal del miembro (adicional a Carnet, QR, Clases).

**Funcionalidades:**
- Muestra el estado actual de membresía del miembro (días restantes, fecha de vencimiento)
- Grid de planes activos del gym con precio en S/
- Botón "Pagar S/XX" por plan — llama a `create-member-payment` con el anon key
- Redirige al checkout de MP en la misma ventana
- Al volver de MP, detecta `?payment=success|failure|pending` y muestra toast correspondiente
- Limpia los query params de la URL tras mostrar el toast para evitar re-mostrar en refresh

---

## 2. Sistema de Clases y Horario

### Modelo de datos

```
classes (plantillas)
  id, tenant_id, name, description, instructor,
  capacity, duration_minutes, color, is_active

class_schedules (slots recurrentes semanales)
  id, tenant_id, class_id → classes,
  day_of_week (0=Dom..6=Sáb), start_time, is_active

class_reservations (reservas individuales por sesión)
  id, tenant_id, member_id → members,
  schedule_id → class_schedules,
  session_date (DATE), status ('confirmed'|'cancelled')
  UNIQUE (member_id, schedule_id, session_date)
```

### Archivos creados

#### `src/pages/Classes.tsx`

Página de gestión completa para admins. Tres pestañas:

**Tab "Mis Clases":**
- Grid de tarjetas de clase separadas en "Activas" / "Desactivadas"
- Cada tarjeta: nombre, instructor, duración, capacidad, color de acento
- Acciones: Editar, Activar/Desactivar, Eliminar (con cascada a schedules y reservas)
- Modal de creación/edición con:
  - Campos: nombre*, descripción, instructor, capacidad, duración (minutos)
  - Paleta de 8 colores preset + preview en tiempo real
  - Validación: nombre requerido, `requireSubscription()` antes de crear

**Tab "Horario Semanal":**
- Grid de 7 columnas (Lun-Dom), scroll horizontal en mobile
- Convención de días: `DAYS = ["Lunes"..."Domingo"]`, `DAY_OF_WEEK = [1,2,3,4,5,6,0]`
- Cada slot muestra: hora, nombre de clase (color de la clase), instructor, capacidad
- Hover → botón "×" para eliminar el slot del horario (no elimina la clase)
- Botón "+ agregar" en cada columna → modal de selección de clase + hora

**Tab "Reservas"** *(admin)*:
- Query a `class_reservations` con join a `members` y `class_schedules(start_time, classes(...))`
- Solo reservas `status = 'confirmed'` desde hoy en adelante
- Agrupadas por fecha (sección por día) → por hora
- Cada sesión: nombre de clase, hora, barra de ocupación (X/Y cupos), lista de miembros
- Ícono de WhatsApp por miembro si tiene teléfono registrado → enlace directo

**Tipos TypeScript:**
```typescript
type GymClass { id, name, description, instructor, capacity, duration_minutes, color, is_active }
type ClassSchedule { id, class_id, day_of_week, start_time, is_active, classes: GymClass }
type ClassReservation { id, member_id, schedule_id, session_date, status, members, class_schedules }
```

**Mutaciones:**
| Función | Operación | Invalidaciones |
|---------|-----------|----------------|
| `saveClass` | insert / update en `classes` | `gym_classes`, `class_schedules` |
| `toggleClass` | update `is_active` | `gym_classes` |
| `deleteClass` | delete (cascada BD) | `gym_classes`, `class_schedules` |
| `addSchedule` | insert en `class_schedules` | `class_schedules` |
| `deleteSchedule` | delete en `class_schedules` | `class_schedules` |

#### `src/pages/PortalMiembro.tsx` — Tab "Clases"

Quinto tab en el portal del miembro. Solo aparece si el gym tiene al menos un slot en el horario semanal.

**Queries del portal:**
```typescript
classSchedules   → class_schedules WHERE tenant_id = gym.tenant_id AND is_active = true
myReservations   → class_reservations WHERE member_id = memberId AND session_date >= today
sessionCounts    → class_reservations GROUP por schedule_id + session_date (conteo por sesión)
```

**`upcomingSessions` (useMemo):**
- Calcula los próximos 7 días
- Para cada día, filtra los slots del horario cuyo `day_of_week` coincida
- Retorna array de `{ date, schedule, alreadyReserved, count, isFull }`

**Acciones del miembro:**
- Botón "Reservar" → insert en `class_reservations` con `status = 'confirmed'`
- Botón "Cancelar" → update `status = 'cancelled'`
- Spots disponibles calculados en tiempo real (capacidad − reservas confirmadas)
- `sessionCounts` query usa `select('schedule_id, session_date')` con conteo client-side

### Archivos modificados

#### `src/components/AppSidebar.tsx`

```typescript
// Añadido a mainNav (entre Planes y Retención)
{ title: "Clases", url: "/classes", icon: CalendarDays }

// Añadido a mainNav (al final de la sección principal)
{ title: "Pagos", url: "/payments", icon: Banknote }
```

#### `src/App.tsx`

```tsx
// Rutas añadidas dentro de AuthenticatedLayoutArea
<Route path="/classes" element={<Classes />} />
<Route path="/payments" element={<Payments />} />

// Ruta pública añadida
<Route path="/g/:slug" element={<GymPublica />} />
```

---

## 3. Historial de Pagos de Miembros

### Archivo creado

#### `src/pages/Payments.tsx`

Página de admin para visualizar todos los pagos de membresías procesados.

**Tarjetas de resumen (4):**
- Ingresos Totales (S/) — suma de todos los `amount` en `member_payments`
- Ingresos del Mes — suma del mes calendario actual
- Pagos Este Mes — conteo de transacciones del mes
- Miembros que Pagaron — `Set(payments.map(p => p.member_id)).size`

**Tabla de pagos:**
| Columna | Fuente | Visibilidad |
|---------|--------|-------------|
| Miembro (nombre + teléfono) | JOIN members | Siempre |
| Plan | plan_name | Siempre |
| Monto | amount (formateado S/) | Siempre |
| Duración | duration_days | ≥ sm |
| Nueva Vencimiento | new_end_date | ≥ md |
| Fecha Pago | paid_at (formateado) | Siempre |

- Máximo 200 registros por query, ordenados por `paid_at DESC`
- Estado vacío con ilustración y mensaje guía

---

## 4. Página Pública del Gym

### Archivo creado

#### `src/pages/GymPublica.tsx`

Landing page pública accesible sin autenticación en `/g/:slug`.

**Secciones:**
1. **Hero** — nombre del gym, dirección, botón WhatsApp ("Consultar por WhatsApp"), link "Soy miembro → /portal"
2. **Planes de Membresía** — grid de planes activos con nombre, descripción, precio S/, días de acceso, botón "Consultar" (pre-rellena mensaje WA con el nombre y precio del plan)
3. **Horario de Clases** — mismo grid 7 columnas de `Classes.tsx` (solo aparece si hay slots configurados)
4. **Footer** — branding Kallpa + link al portal

**Queries (todas públicas, sin auth):**
```typescript
// 1. Gym por slug
supabase.from("gym_settings").select("tenant_id, gym_name, slug, address, ...").eq("slug", slug)

// 2. Planes activos
supabase.from("membership_plans").select("...").eq("tenant_id", gym.tenant_id).eq("is_active", true)

// 3. Horario semanal
supabase.from("class_schedules").select("..., classes(...)").eq("tenant_id", gym.tenant_id).eq("is_active", true)
```

**Estado 404:** si el slug no existe → pantalla con ícono, mensaje amigable y link a home.

**IMPORTANTE:** Requiere RLS policies de lectura pública (ver sección SQL más abajo).

### Archivos modificados

#### `src/pages/Settings.tsx` — Campo slug en Tab "Empresa"

- Input para definir el slug (auto-sanitizado a `[a-z0-9-]`)
- Preview del URL completo: `https://dominio.com/g/mi-gym`
- Botón copiar al portapapeles con toast de confirmación
- El slug se guarda junto con el resto de `updateSettings` (sanitizado antes de enviar)

**Sanitización del slug:**
```typescript
const sanitizedSlug = gymSlug
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "") || null;
```

---

## 5. Migración SQL Requerida

### Archivo

`supabase/migrations/20260312_gym_slug_and_public_access.sql`

### Contenido

```sql
-- Columna slug en gym_settings
ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS gym_settings_slug_idx
  ON gym_settings (slug) WHERE slug IS NOT NULL;

-- Lectura pública de gym_settings (para /g/:slug)
CREATE POLICY "Public read gym settings"
  ON gym_settings FOR SELECT USING (true);

-- Lectura pública de membership_plans (planes activos en página pública)
CREATE POLICY "Public read active plans"
  ON membership_plans FOR SELECT USING (is_active = true);

-- Lectura pública de class_schedules y classes (horario en página pública)
CREATE POLICY "Public read active schedules"
  ON class_schedules FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active classes"
  ON classes FOR SELECT USING (is_active = true);
```

> **Ejecutar en:** Supabase Dashboard → SQL Editor, o via `supabase db push`

---

## 6. Variables de Entorno

| Variable | Dónde se usa | Descripción |
|----------|-------------|-------------|
| `VITE_SUPABASE_URL` | Frontend | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Clave pública (portal miembro, página pública) |
| `SUPABASE_URL` | Edge Functions | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Clave de servicio (bypass RLS) |
| `MP_WEBHOOK_SECRET` | `mp-member-webhook` | Secreto HMAC para verificar firma de MP (opcional pero recomendado) |

> El `mp_access_token` de cada gym se almacena en `gym_settings.mp_access_token` (cifrado en reposo por Supabase). No hay token global de MP para pagos de miembros.

---

## 7. Rutas del Sistema (estado completo)

### Públicas (sin autenticación)
| Ruta | Componente | Descripción |
|------|------------|-------------|
| `/` | `Landing` | Landing de Kallpa |
| `/login` | `Login` | Login con tabs admin/staff |
| `/register` | `Register` | Registro de nuevos gyms |
| `/forgot-password` | `ForgotPassword` | Recuperación de contraseña |
| `/update-password` | `ResetPassword` | Reset vía email |
| `/carnet/:memberId` | `CarnetPublico` | Carnet QR público |
| `/portal` | `PortalBusqueda` | Búsqueda de miembro por DNI/teléfono |
| `/portal/:memberId` | `PortalMiembro` | Portal con tabs: Carnet · QR · Renovar · Clases |
| `/g/:slug` | `GymPublica` | Página pública del gym |

### Recepción (auth propio de staff)
| Ruta | Componente |
|------|------------|
| `/recepcion` | `Recepcion` |
| `/recepcion/aceptar` | `AceptarInvitacion` |

### Autenticadas (AuthGuard + SubscriptionGuard + Layout)
| Ruta | Componente |
|------|------------|
| `/dashboard` | `Dashboard` |
| `/terminal` | `Terminal` |
| `/members` | `Members` |
| `/plans` | `Plans` |
| `/classes` | `Classes` |
| `/retention` | `Retention` |
| `/payments` | `Payments` |
| `/subscription` | `Subscription` |
| `/affiliate` | `Affiliate` |
| `/settings` | `Settings` |

### Superadmin (AuthGuard + SubscriptionGuard + AdminGuard)
| Ruta | Componente |
|------|------------|
| `/admin` | `AdminDashboard` |
| `/admin/licenses` | `AdminLicenses` |
| `/admin/clients` | `AdminClients` |
| `/admin/affiliates` | `AdminAffiliates` |
| `/admin/settings` | `AdminSettings` |

---

## 8. Patrones de código aplicados

### Idempotencia en webhooks
```typescript
// Antes de procesar, verificar si ya existe el registro
const { data: existing } = await supabase
  .from("member_payments")
  .select("id")
  .eq("mp_payment_id", `MP-MEMBER-${paymentId}`)
  .maybeSingle();
if (existing) return; // ya procesado
```

### Stacking de fechas (renovaciones)
```typescript
// La nueva fecha parte del máximo entre hoy y la fecha actual del miembro
const today = new Date();
const currentEnd = member.end_date ? new Date(member.end_date) : today;
const baseDate = currentEnd > today ? currentEnd : today;
const newEndDate = new Date(baseDate);
newEndDate.setDate(newEndDate.getDate() + plan.duration_days);
```

### Tenant isolation
Todas las queries de admins incluyen `.eq("tenant_id", user.tenantId)`.
Las Edge Functions usan `service_role_key` para bypassear RLS y acceder a cualquier tenant.

### AnimatePresence en JSX
Se usa el patrón `&&` en lugar de ternario encadenado para evitar errores de parseo de esbuild:
```tsx
// ✅ Correcto
{tab === "a" && <motion.div key="a">...</motion.div>}
{tab === "b" && <motion.div key="b">...</motion.div>}

// ❌ Causa error "Expected } but found :"
{tab === "a" ? <motion.div>...</motion.div> : tab === "b" ? <motion.div>...</motion.div> : null}
```

### Queries del portal (sin auth)
El portal es público; las queries usan el cliente Supabase con `anon key`. Las RLS policies
deben permitir `SELECT` anónimo donde sea necesario (ver migración SQL).

---

## 9. Estructura de archivos relevantes

```
src/
├── components/
│   ├── AppSidebar.tsx          ← +Clases, +Pagos en nav
│   ├── AuthGuard.tsx
│   └── ...
├── pages/
│   ├── Classes.tsx             ← NUEVO (Mis Clases + Horario + Reservas)
│   ├── Payments.tsx            ← NUEVO (historial pagos de miembros)
│   ├── GymPublica.tsx          ← NUEVO (página pública /g/:slug)
│   ├── PortalMiembro.tsx       ← +Tab Renovar, +Tab Clases
│   ├── Settings.tsx            ← +Tab Pagos (MP token), +Slug URL pública
│   └── ...
├── App.tsx                     ← +routes /classes /payments /g/:slug

supabase/
├── functions/
│   ├── create-member-payment/  ← NUEVA edge function
│   │   └── index.ts
│   ├── mp-member-webhook/      ← NUEVA edge function
│   │   └── index.ts
│   └── ...
└── migrations/
    └── 20260312_gym_slug_and_public_access.sql  ← NUEVA migración
```
