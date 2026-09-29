// Conexión de la página con Supabase (ver CONFIGURAR_ACCESO.md).
// Mientras estos campos estén vacíos, el ingreso funciona en modo demostración, sin datos reales.
// La "anon" o "publishable" key es pública por diseño. NUNCA pongas aquí la service_role / secret key.
window.CIC_CONFIG = {
  supabaseUrl: '',      // ej.: 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: '',  // Project Settings → API Keys → anon / publishable
  funcion: 'cic-acceso'
};
