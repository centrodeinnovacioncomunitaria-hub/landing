# Activar el ingreso del CIC

La página funciona en **modo demostración** mientras `config.js` esté vacío: se puede entrar con cualquier cédula para ver cómo se ve, pero no se guarda nada ni se envían correos. Para que el equipo y las emprendedoras entren de verdad, siga estos pasos una sola vez (unos 20 minutos).

## Cómo funciona

| Perfil | Cómo entra la primera vez |
|---|---|
| **Secretaría Técnica** (5 personas del directorio) | Cédula + contraseña = su misma cédula. La página le pide cambiarla. |
| **Dinamizadora** (24 personas del directorio) | Igual: cédula + cédula. |
| **Emprendedora** | Crea su cuenta en «Crear cuenta» (nombre, cédula, correo, celular, departamento, municipio y contraseña). Después entra con cédula y contraseña, eligiendo el perfil Emprendedora. |

- Si alguien elige un perfil que no es el suyo, la página le dice cuál es el correcto.
- Al cambiar la contraseña llega un correo de confirmación, enviado desde centrodeinnovacioncomunitaria@gmail.com, al correo de su perfil.
- Si alguien olvida la contraseña, la Secretaría Técnica la restablece desde *Seguimiento* (vuelve a ser la cédula) y la persona recibe un correo de aviso.
- La Secretaría ve a todas las personas; cada dinamizadora ve las emprendedoras de su departamento; cada emprendedora ve solo sus datos.

Los datos personales **no** están en este repositorio (es público). Viven en la base de datos de Supabase.

## 1. Crear el proyecto en Supabase

1. Entrar a https://supabase.com con la cuenta centrodeinnovacioncomunitaria@gmail.com y crear un proyecto (plan gratuito, región *South America (São Paulo)*).
2. En **Authentication → Sign In / Providers → Email**:
   - desactivar **Confirm email** (las cuentas se crean ya confirmadas);
   - en **Password requirements**, dejar la longitud mínima en 6 y **sin** exigir letras o símbolos: la contraseña inicial del equipo es la cédula.
3. En **Authentication → Sign In / Providers**, desactivar **Allow new users to sign up**. Las cuentas solo se crean desde la función `cic-acceso`.

## 2. Crear las tablas

En **SQL Editor**, pegar y ejecutar, en este orden:

1. `supabase/migrations/20260928000000_cic_acceso.sql` (de este repositorio).
2. `directorio_equipo_cic.sql`, que está en la carpeta privada `privado_NO_SUBIR` (fuera del repositorio). Trae las 29 personas del Excel del equipo.

Para sumar o corregir personas del equipo más adelante, se edita la tabla `directorio` en **Table Editor**.

## 3. Contraseña de aplicación de Gmail

Los correos salen de centrodeinnovacioncomunitaria@gmail.com. Gmail pide una contraseña especial para esto:

1. En la cuenta de Google, activar la **verificación en dos pasos**.
2. Ir a https://myaccount.google.com/apppasswords, crear una contraseña de aplicación llamada «CIC» y copiar las 16 letras.

## 4. Publicar la función `cic-acceso`

En **Edge Functions → Deploy a new function → Via editor**:

1. Nombre: `cic-acceso`.
2. Pegar el contenido de `supabase/functions/cic-acceso/index.ts` y desplegar.
3. En la configuración de la función, **desactivar «Verify JWT»** (la función revisa la sesión por su cuenta).
4. En **Edge Functions → Secrets**, agregar:
   - `SMTP_USER` = `centrodeinnovacioncomunitaria@gmail.com`
   - `SMTP_PASS` = la contraseña de aplicación de 16 letras.

Con la CLI de Supabase es equivalente: `supabase functions deploy cic-acceso --no-verify-jwt` y `supabase secrets set SMTP_USER=... SMTP_PASS=...`.

Si la página se publica en otro dominio, agregar el secreto `CIC_ORIGENES` con las direcciones permitidas separadas por comas (por defecto: `https://centrodeinnovacioncomunitaria-hub.github.io`).

## 5. Conectar la página

En **Project Settings → API Keys**, copiar la **URL del proyecto** y la llave **anon / publishable**, y pegarlas en `config.js`:

```js
window.CIC_CONFIG = {
  supabaseUrl: 'https://xxxxxxxx.supabase.co',
  supabaseAnonKey: 'la-llave-anon-o-publishable',
  funcion: 'cic-acceso'
};
```

Esa llave es pública por diseño. **Nunca** poner en `config.js` la llave `service_role` / `secret`.

## 6. Probar

1. Entrar como Secretaría Técnica con una cédula del directorio (contraseña = cédula).
2. Cambiar la contraseña en *Mi cuenta* y revisar que llegue el correo.
3. Crear una cuenta de emprendedora de prueba y verla en *Seguimiento*.

## Datos del Excel que conviene revisar

- **Pamela Lizeth Peña Correa**: el correo dice `saimpeco@gmaill.com` (con doble l). Si es un error, no le llegarán los avisos.
- **Ledys Hernández Jiménez**: en la hoja general no tiene correo; se tomó `carmenjimenezcorrea@hotmail.com` de la hoja de Sucre.
- **Alina Esther Mendoza Mercado**: en la hoja general falta la cédula; se tomó 57434709 de la hoja de Bolívar.
- **María Inés Cotes Peña**: la hoja general dice Cesar y la de La Guajira la incluye; se dejó La Guajira, según su cargo.
- **Libia Luna** y **Doris Arregoces**: los apellidos difieren entre hojas; se usó el más completo.
- **Wilson Darío Correa Oliva** y **Arturo Mayoral Romero** figuran en el equipo; la página usa «Dinamizadora» y «Secretaría Técnica» como nombre del perfil.
