// Biblioteca de recursos: filtros por tema, búsqueda, enlaces directos a un tema y calculadora de punto de equilibrio.
(() => {
    'use strict';
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');
    const pesos = (n) => '$' + Math.round(n).toLocaleString('es-CO');

    const recursos = $$('#lista-recursos .recurso');
    const filtros = $$('.filtro');
    const buscador = $('#buscar-recurso');
    const vacio = $('#sin-recursos');
    const contador = $('#contador-recursos');
    let tema = '';

    filtros.forEach((f) => {
        $('small', f).textContent = f.dataset.tema ? recursos.filter((r) => r.dataset.tema === f.dataset.tema).length : recursos.length;
    });

    // Búsqueda por palabras, sin tildes ni mayúsculas. Las palabras cortas (como «RUT») deben coincidir completas;
    // las de 4 letras o más también valen como comienzo de palabra («inver» encuentra «inversión»).
    const normal = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const palabrasDe = new Map(recursos.map((r) => {
        const texto = $$('.chip, h3, p, details', r).map((e) => e.textContent).join(' ');
        return [r, normal(texto).split(/[^a-z0-9ñ]+/).filter(Boolean)];
    }));
    const coincide = (r, terminos) => terminos.every((t) => palabrasDe.get(r).some((p) => (t.length <= 3 ? p === t : p.startsWith(t))));

    function filtrar() {
        const terminos = normal(buscador.value).split(/[^a-z0-9ñ]+/).filter(Boolean);
        let visibles = 0;
        recursos.forEach((r) => {
            const ok = (!tema || r.dataset.tema === tema) && (!terminos.length || coincide(r, terminos));
            r.hidden = !ok;
            if (ok) visibles++;
        });
        vacio.hidden = visibles > 0;
        contador.textContent = visibles === recursos.length ? `Mostrando las ${visibles} plantillas` : `Mostrando ${visibles} de ${recursos.length} plantillas`;
    }
    function elegirTema(nuevo, actualizarEnlace = true) {
        tema = nuevo;
        filtros.forEach((f) => f.setAttribute('aria-pressed', String(f.dataset.tema === tema)));
        filtrar();
        if (actualizarEnlace) history.replaceState(null, '', tema ? `#tema-${tema}` : location.pathname);
    }
    filtros.forEach((f) => f.addEventListener('click', () => elegirTema(f.dataset.tema)));
    buscador.addEventListener('input', filtrar);

    // Enlaces directos: /recursos/#tema-finanzas filtra; /recursos/#canvas-esquina muestra esa plantilla
    function desdeEnlace() {
        const h = decodeURIComponent(location.hash.slice(1));
        if (h.startsWith('tema-')) {
            const t = h.slice(5);
            if (filtros.some((f) => f.dataset.tema === t)) elegirTema(t, false);
            const lista = $('#biblioteca');
            if (lista) lista.scrollIntoView();
            return;
        }
        const objetivo = h && document.getElementById(h);
        if (objetivo && objetivo.classList.contains('recurso') && objetivo.hidden) { buscador.value = ''; elegirTema('', false); objetivo.scrollIntoView(); }
        if (objetivo) { const d = $('details', objetivo); if (d) d.open = true; }
    }
    addEventListener('hashchange', desdeEnlace);
    desdeEnlace();
    filtrar();

    // Calculadora de punto de equilibrio
    function calcular() {
        const fijos = Number(soloDigitos($('#pe-fijos').value));
        const precio = Number(soloDigitos($('#pe-precio').value));
        const costo = Number(soloDigitos($('#pe-costo').value));
        const r = $('#pe-resultado');
        if (!fijos || !precio) { r.textContent = 'Escribe tus costos fijos y tu precio de venta.'; return; }
        if (precio <= costo) { r.textContent = 'Tu precio no cubre lo que te cuesta producir: revisa el precio o el costo por unidad.'; return; }
        const unidades = Math.ceil(fijos / (precio - costo));
        r.replaceChildren();
        const b = document.createElement('b');
        b.textContent = `${unidades.toLocaleString('es-CO')} unidades al mes`;
        r.append(b, `Cada venta te deja ${pesos(precio - costo)} para cubrir los costos fijos. Vendiendo ${unidades.toLocaleString('es-CO')} unidades (${pesos(unidades * precio)}) no ganas ni pierdes; desde la siguiente, ganas.`);
    }
    $$('#calculadora input').forEach((i) => i.addEventListener('input', () => { i.value = soloDigitos(i.value); calcular(); }));
    $('#calculadora').addEventListener('submit', (e) => e.preventDefault());
    calcular();
})();
