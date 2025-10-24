# UniBus (scaffold)

Proyecto simple para gestionar registros de viaje (formulario público) y un roster para que el admin vea y marque pagos.

Características incluidas:
- Frontend con Vite + React
- Conexión con Firebase (Auth y Firestore)
- Formulario público que crea documentos en la colección `registrations`
- Roster admin protegido por Firebase Auth que lista y permite marcar `paid`

Requisitos previos:
- Node 18+ y npm
- Cuenta en Firebase: crear proyecto, habilitar Firestore en modo nativo y Authentication (Email/Password)
- (Opcional) Cuenta en Vercel para despliegue

Pasos rápidos para correr localmente:
1. Copia `.env.example` a `.env.local` y completa las variables con las credenciales de Firebase.
2. Instala dependencias:

```powershell
npm install
```

3. Inicia en modo desarrollo:

```powershell
npm run dev
```

4. Crea un usuario admin desde la consola de Firebase (Authentication -> Users) con el correo que pongas en `VITE_ADMIN_EMAIL` o pon el correo del admin en la variable de entorno.

Despliegue a Vercel:
- Conecta el repo a Vercel y añade las mismas variables de entorno en el panel de Vercel.
- Comando de build: `npm run build`.

Si quieres, me encargo de guiarte paso a paso para crear el proyecto en Firebase, generar las credenciales y desplegar en Vercel.
