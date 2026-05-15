# ReciboTrack

Aplicación web para escanear recibos con OCR (Claude Vision) y controlar gastos personales/negocio.

## Stack

- Next.js 16 (App Router) + TypeScript
- Firebase (Auth + Firestore + Storage)
- Claude claude-sonnet-4-5 para OCR
- Tailwind CSS v4 + diseño editorial minimalista

---

## Configuración paso a paso

### 1. Crear proyecto en Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Agregar proyecto** → ponle un nombre (ej: `recibotrack`)
3. Desactiva Google Analytics si no lo necesitas → **Crear proyecto**

### 2. Habilitar Authentication

1. En la consola, ve a **Authentication** → **Comenzar**
2. Pestaña **Sign-in method** → habilita:
   - **Google** → actívalo → guarda el email de soporte → **Guardar**
   - **Correo electrónico/contraseña** → actívalo → **Guardar**

### 3. Habilitar Firestore

1. Ve a **Firestore Database** → **Crear base de datos**
2. Elige **Modo de producción** → selecciona ubicación (ej: `us-central1`) → **Listo**
3. Ve a la pestaña **Reglas** → pega el contenido de `firestore.rules` → **Publicar**

### 4. Habilitar Storage

1. Ve a **Storage** → **Comenzar**
2. Elige **Modo de producción** → misma ubicación que Firestore → **Listo**
3. Ve a la pestaña **Reglas** → pega el contenido de `storage.rules` → **Guardar**

### 5. Obtener credenciales del cliente

1. En la consola, ve al ícono de engranaje → **Configuración del proyecto**
2. Sección **Tus apps** → click `</>` (Web)
3. Registra la app (nombre: `recibotrack-web`) → **Registrar app**
4. Copia los valores del objeto `firebaseConfig`

### 6. Configurar variables de entorno

Crea el archivo `.env.local` en la raíz del proyecto (copia de `.env.local.example`):

```bash
cp .env.local.example .env.local
```

Llena los valores:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

ANTHROPIC_API_KEY=sk-ant-...
```

### 7. Conseguir la API Key de Anthropic

1. Ve a [console.anthropic.com](https://console.anthropic.com)
2. **API Keys** → **Create Key**
3. Copia la key y pégala como `ANTHROPIC_API_KEY` en `.env.local`

### 8. Correr en desarrollo

```bash
cd recibotrack
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) → te redirige al login.

---

## Deploy en Vercel

### Opción A: desde la CLI

```bash
npm install -g vercel
vercel
```

Sigue las instrucciones. Al final, agrega las variables de entorno:

```bash
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
vercel env add ANTHROPIC_API_KEY
# etc para cada variable
```

### Opción B: desde el dashboard de Vercel

1. Ve a [vercel.com](https://vercel.com) → **New Project**
2. Importa el repositorio de GitHub
3. En **Environment Variables**, agrega todas las variables de `.env.local`
4. Click **Deploy**

### Configurar dominio autorizado en Firebase

Cuando tengas el dominio de Vercel (ej: `recibotrack.vercel.app`):

1. Firebase Console → Authentication → Settings → **Dominios autorizados**
2. **Agregar dominio** → pega tu dominio de Vercel

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/login/          # Pantalla de login
│   ├── (app)/
│   │   ├── dashboard/         # Dashboard con métricas
│   │   ├── expenses/          # Lista de gastos
│   │   ├── budgets/           # Presupuestos por categoría
│   │   └── categories/        # Gestión de categorías
│   └── api/ocr/               # Route Handler OCR (server-side)
├── components/
│   ├── dashboard/             # Gráficos y stats
│   ├── expenses/              # Lista, edición, exportación
│   ├── receipt-scanner/       # Scanner con drag&drop y cámara
│   ├── navigation/            # TopNav + BottomNav
│   └── ui/                    # Componentes base (shadcn)
├── hooks/                     # Lógica de Firestore
├── lib/
│   ├── firebase/              # Config + schemas zod
│   └── ocr/                   # Integración Claude (server-only)
└── stores/                    # Estado global (Zustand)
```

## Modelo de datos (Firestore)

```
users/{uid}
  └── expenses/{id}     # Gastos escaneados
  └── categories/{id}   # Categorías (default + custom)
  └── budgets/{id}      # Presupuestos mensuales
```
