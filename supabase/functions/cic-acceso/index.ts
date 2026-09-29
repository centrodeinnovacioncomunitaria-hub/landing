// Supabase Edge Function · cic-acceso
// Ingreso con cédula y perfil, registro de emprendedoras, cambio de contraseña con correo de aviso
// y restablecimiento por la Secretaría Técnica.
//
// Secretos que necesita (Supabase → Edge Functions → Secrets):
//   SMTP_USER  centrodeinnovacioncomunitaria@gmail.com
//   SMTP_PASS  contraseña de aplicación de Gmail (16 letras, no la contraseña normal)
// Opcionales: SMTP_HOST (smtp.gmail.com), SMTP_PORT (465), CIC_ORIGENES, CIC_DOMINIO_CUENTAS.
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.

import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? SERVICE_KEY;
// Supabase Auth trabaja con correos. Cada cuenta usa uno interno hecho con la cédula
// (nunca recibe mensajes); el correo real de la persona queda en su perfil.
const DOMINIO = Deno.env.get('CIC_DOMINIO_CUENTAS') ?? 'cuentas.cic.invalid';
const ORIGENES = (Deno.env.get('CIC_ORIGENES') ??
  'https://centrodeinnovacioncomunitaria-hub.github.io,http://localhost:8080,http://127.0.0.1:8080')
  .split(',').map((s) => s.trim()).filter(Boolean);

const ROLES = ['secretaria', 'dinamizadora', 'emprendedora'];
const NOMBRE_ROL: Record<string, string> = {
  secretaria: 'Secretaría Técnica',
  dinamizadora: 'Dinamizadora',
  emprendedora: 'Emprendedora',
};
const DEPARTAMENTOS = ['Atlántico', 'Bolívar', 'Cesar', 'Córdoba', 'La Guajira', 'Magdalena', 'Sucre'];
const CAMPOS_PERFIL =
  'id, cedula, nombre, rol, cargo, correo, celular, departamento, municipio, negocio, debe_cambiar_clave';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

class Falla extends Error {
  constructor(public estado: number, public codigo: string, mensaje: string, public extra: Record<string, unknown> = {}) {
    super(mensaje);
  }
}

const soloDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const texto = (v: unknown, max = 120) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const correoCuenta = (cedula: string) => `${cedula}@${DOMINIO}`;
const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);
const enmascarar = (c: string) => c.replace(/^(.)[^@]*(@.*)$/, '$1***$2');

function validarCedula(v: unknown) {
  const c = soloDigitos(v);
  if (c.length < 5 || c.length > 12) throw new Falla(400, 'cedula', 'Escribe tu número de cédula, solo números.');
  return c;
}

// Verifica la contraseña iniciando sesión, y devuelve la sesión (o null si no coincide).
async function iniciarSesion(cedula: string, clave: string) {
  const cliente = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await cliente.auth.signInWithPassword({ email: correoCuenta(cedula), password: clave });
  if (error || !data.session) return null;
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

async function perfilPorCedula(cedula: string) {
  const { data, error } = await admin.from('perfiles').select(CAMPOS_PERFIL).eq('cedula', cedula).maybeSingle();
  if (error) throw error;
  return data;
}

async function crearCuenta(cedula: string, clave: string, perfil: Record<string, unknown>) {
  const { data, error } = await admin.auth.admin.createUser({
    email: correoCuenta(cedula),
    password: clave,
    email_confirm: true,
    app_metadata: { rol: perfil.rol },
  });
  if (error || !data.user) {
    console.error('createUser', error);
    throw new Falla(500, 'cuenta', 'No pudimos crear la cuenta. Escríbenos para revisarlo.');
  }
  const { data: fila, error: e2 } = await admin.from('perfiles')
    .insert({ id: data.user.id, cedula, ...perfil }).select(CAMPOS_PERFIL).single();
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw e2;
  }
  return fila;
}

// Quien da su cédula como contraseña y aparece en el directorio del equipo, entra por primera vez.
async function activarDesdeDirectorio(cedula: string, clave: string) {
  if (clave !== cedula) return null;
  const { data: d, error } = await admin.from('directorio').select('*').eq('cedula', cedula).maybeSingle();
  if (error) throw error;
  if (!d) return null;
  return crearCuenta(cedula, cedula, {
    nombre: d.nombre, rol: d.rol, cargo: d.cargo, correo: d.correo, celular: d.celular,
    departamento: d.departamento, debe_cambiar_clave: true,
  });
}

async function ingresar(b: Record<string, unknown>) {
  const cedula = validarCedula(b.cedula);
  const clave = String(b.clave ?? '');
  const rol = String(b.rol ?? '');
  if (!ROLES.includes(rol)) throw new Falla(400, 'rol', 'Elige tu perfil: Secretaría Técnica, Dinamizadora o Emprendedora.');
  if (!clave) throw new Falla(400, 'clave', 'Escribe tu contraseña.');

  const perfil = (await perfilPorCedula(cedula)) ?? (await activarDesdeDirectorio(cedula, clave));
  const sesion = perfil ? await iniciarSesion(cedula, clave) : null;
  if (!perfil || !sesion) {
    throw new Falla(401, 'credenciales', rol === 'emprendedora'
      ? 'La cédula o la contraseña no coinciden. Si aún no tienes cuenta, créala en «Crear cuenta».'
      : 'La cédula o la contraseña no coinciden. Si es tu primera vez, tu contraseña es tu número de cédula.');
  }
  // La contraseña ya se verificó: aquí sí podemos decirle cuál es su perfil.
  if (perfil.rol !== rol) {
    throw new Falla(403, 'rol', `Tu cuenta está registrada como ${NOMBRE_ROL[perfil.rol]}. Elige ese perfil para entrar.`, { rol: perfil.rol });
  }
  return { sesion, perfil };
}

async function registrar(b: Record<string, unknown>) {
  const cedula = validarCedula(b.cedula);
  const nombre = texto(b.nombre, 90);
  const correo = texto(b.correo, 120).toLowerCase();
  const celular = soloDigitos(b.celular).slice(0, 12);
  const departamento = texto(b.departamento, 40);
  const municipio = texto(b.municipio, 60);
  const negocio = texto(b.negocio, 90);
  const clave = String(b.clave ?? '');

  if (nombre.length < 5 || !nombre.includes(' ')) throw new Falla(400, 'nombre', 'Escribe tu nombre y apellido.');
  if (!correoValido(correo)) throw new Falla(400, 'correo', 'Revisa tu correo electrónico: ahí te avisaremos de cambios en tu cuenta.');
  if (celular.length < 7) throw new Falla(400, 'celular', 'Escribe tu número de celular o WhatsApp.');
  if (!DEPARTAMENTOS.includes(departamento)) throw new Falla(400, 'departamento', 'Elige tu departamento.');
  if (!municipio) throw new Falla(400, 'municipio', 'Escribe tu municipio.');
  if (clave.length < 8) throw new Falla(400, 'clave', 'La contraseña debe tener al menos 8 caracteres.');
  if (b.acepto !== true) throw new Falla(400, 'acepto', 'Para crear la cuenta debes autorizar el tratamiento de tus datos.');

  const { data: delEquipo } = await admin.from('directorio').select('cedula').eq('cedula', cedula).maybeSingle();
  if (delEquipo) throw new Falla(409, 'equipo', 'Esta cédula es del equipo del CIC. Ingresa como Secretaría Técnica o Dinamizadora.');
  if (await perfilPorCedula(cedula)) throw new Falla(409, 'existe', 'Esta cédula ya tiene cuenta. Ingresa con tu cédula y tu contraseña.');

  const perfil = await crearCuenta(cedula, clave, {
    nombre, rol: 'emprendedora', correo, celular, departamento, municipio, negocio: negocio || null,
    acepto_datos_en: new Date().toISOString(),
  });
  const sesion = await iniciarSesion(cedula, clave);
  return { sesion, perfil };
}

async function usuarioDelToken(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data, error } = token ? await admin.auth.getUser(token) : { data: { user: null }, error: true };
  if (error || !data.user) throw new Falla(401, 'sesion', 'Tu sesión terminó. Vuelve a ingresar.');
  const { data: perfil, error: e2 } = await admin.from('perfiles').select(CAMPOS_PERFIL).eq('id', data.user.id).single();
  if (e2 || !perfil) throw new Falla(401, 'sesion', 'Tu sesión terminó. Vuelve a ingresar.');
  return perfil;
}

async function cambiarClave(req: Request, b: Record<string, unknown>) {
  const perfil = await usuarioDelToken(req);
  const actual = String(b.clave_actual ?? '');
  const nueva = String(b.clave_nueva ?? '');
  if (nueva.length < 8) throw new Falla(400, 'clave', 'La nueva contraseña debe tener al menos 8 caracteres.');
  if (nueva === perfil.cedula) throw new Falla(400, 'clave', 'La nueva contraseña no puede ser tu número de cédula.');
  if (nueva === actual) throw new Falla(400, 'clave', 'La nueva contraseña debe ser distinta de la actual.');
  if (!(await iniciarSesion(perfil.cedula, actual))) throw new Falla(401, 'clave_actual', 'La contraseña actual no es correcta.');

  const { error } = await admin.auth.admin.updateUserById(perfil.id, { password: nueva });
  if (error) {
    console.error('updateUserById', error);
    throw new Falla(500, 'clave', 'No pudimos cambiar la contraseña. Intenta de nuevo.');
  }
  await admin.from('perfiles').update({ debe_cambiar_clave: false, clave_cambiada_en: new Date().toISOString() }).eq('id', perfil.id);

  const correoEnviado = await avisarPorCorreo(perfil, 'cambio');
  return { ok: true, correoEnviado, correo: perfil.correo ? enmascarar(perfil.correo) : null };
}

async function restablecer(req: Request, b: Record<string, unknown>) {
  const quien = await usuarioDelToken(req);
  if (quien.rol !== 'secretaria') throw new Falla(403, 'permiso', 'Solo la Secretaría Técnica puede restablecer contraseñas.');
  const cedula = validarCedula(b.cedula);
  const perfil = await perfilPorCedula(cedula);
  if (!perfil) throw new Falla(404, 'no_existe', 'Esta persona aún no ha ingresado: su contraseña inicial sigue siendo su cédula.');

  const { error } = await admin.auth.admin.updateUserById(perfil.id, { password: cedula });
  if (error) throw new Falla(500, 'clave', 'No pudimos restablecer la contraseña.');
  await admin.from('perfiles').update({ debe_cambiar_clave: true, clave_cambiada_en: new Date().toISOString() }).eq('id', perfil.id);

  const correoEnviado = await avisarPorCorreo(perfil, 'restablecida');
  return { ok: true, correoEnviado, correo: perfil.correo ? enmascarar(perfil.correo) : null };
}

// ---------- Correo de aviso ----------
async function avisarPorCorreo(perfil: { nombre: string; correo: string | null; cedula: string }, motivo: 'cambio' | 'restablecida') {
  const usuario = Deno.env.get('SMTP_USER');
  const clave = Deno.env.get('SMTP_PASS');
  if (!perfil.correo || !usuario || !clave) return false;

  const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short' });
  const nombre = perfil.nombre.split(' ')[0];
  const cola = perfil.cedula.slice(-4);
  const asunto = motivo === 'cambio' ? 'Tu contraseña del CIC fue cambiada' : 'Tu contraseña del CIC fue restablecida';
  const detalle = motivo === 'cambio'
    ? `La contraseña de tu cuenta del Centro de Innovación Comunitaria (cédula terminada en ${cola}) se cambió el ${fecha}.`
    : `La Secretaría Técnica restableció la contraseña de tu cuenta (cédula terminada en ${cola}) el ${fecha}. Ahora tu contraseña es tu número de cédula: al entrar, cámbiala por una nueva.`;
  const cierre = motivo === 'cambio'
    ? 'Si fuiste tú, no tienes que hacer nada. Si no reconoces este cambio, responde este correo o avísale a la Secretaría Técnica para proteger tu cuenta.'
    : 'Si no pediste este cambio, responde este correo.';

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#FFF6EE;font-family:'Nunito Sans',Arial,sans-serif;color:#2E4A3E">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF6EE;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:#2E4A3E;padding:22px 28px;color:#ffffff;font-family:Quicksand,Arial,sans-serif;font-size:22px;font-weight:700">cic <span style="font-size:13px;font-weight:600;opacity:.85">Centro de Innovación Comunitaria</span></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#B04A36;font-weight:700">Aviso de seguridad</p>
<h1 style="margin:0 0 16px;font-family:Quicksand,Arial,sans-serif;font-size:22px">Hola, ${escapar(nombre)}</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${escapar(detalle)}</p>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6">${escapar(cierre)}</p>
<p style="margin:0;font-size:13px;color:#4F6B5E">Este correo se envía automáticamente cuando cambia la contraseña de tu cuenta.</p>
</td></tr></table>
<p style="font-size:12px;color:#4F6B5E;margin:18px 0 0">Centro de Innovación Comunitaria · Red de Mujeres del Caribe</p>
</td></tr></table></body></html>`;

  try {
    const puerto = Number(Deno.env.get('SMTP_PORT') ?? 465);
    const transporte = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com',
      port: puerto,
      secure: puerto === 465,
      auth: { user: usuario, pass: clave },
    });
    await transporte.sendMail({
      from: `"Centro de Innovación Comunitaria" <${usuario}>`,
      to: perfil.correo,
      subject: asunto,
      text: `Hola, ${nombre}.\n\n${detalle}\n\n${cierre}\n\nCentro de Innovación Comunitaria`,
      html,
    });
    return true;
  } catch (e) {
    console.error('correo', e);
    return false;
  }
}

function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// ---------- Servidor ----------
function cabeceras(origen: string | null) {
  const permitido = origen && (ORIGENES.includes('*') || ORIGENES.includes(origen)) ? origen : ORIGENES[0];
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

Deno.serve(async (req) => {
  const h = cabeceras(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return new Response(JSON.stringify({ mensaje: 'Método no permitido' }), { status: 405, headers: h });

  try {
    const b = await req.json().catch(() => ({}));
    let r;
    switch (b.accion) {
      case 'ingresar': r = await ingresar(b); break;
      case 'registro': r = await registrar(b); break;
      case 'cambiar-clave': r = await cambiarClave(req, b); break;
      case 'restablecer': r = await restablecer(req, b); break;
      default: throw new Falla(400, 'accion', 'Acción desconocida.');
    }
    return new Response(JSON.stringify(r), { headers: h });
  } catch (e) {
    if (e instanceof Falla) {
      return new Response(JSON.stringify({ codigo: e.codigo, mensaje: e.message, ...e.extra }), { status: e.estado, headers: h });
    }
    console.error(e);
    return new Response(JSON.stringify({ codigo: 'error', mensaje: 'Algo salió mal. Intenta de nuevo en un momento.' }), { status: 500, headers: h });
  }
});
