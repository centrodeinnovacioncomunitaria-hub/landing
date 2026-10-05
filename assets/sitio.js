// Comportamiento común a todas las páginas del portal: menú en celular, submenús y apariciones suaves.
(() => {
    'use strict';
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];

    // Menú en celular
    const menu = $('#menu-btn'), nav = $('#nav-publica');
    if (menu && nav) {
        menu.addEventListener('click', () => {
            const abierto = nav.classList.toggle('abierta');
            menu.setAttribute('aria-expanded', String(abierto));
        });
    }

    // Submenús: se abren con clic o teclado, se cierran con Escape, al hacer clic fuera o al elegir un enlace
    const botones = $$('.submenu-btn');
    const cerrar = (excepto) => botones.forEach((b) => {
        if (b === excepto) return;
        b.setAttribute('aria-expanded', 'false');
        document.getElementById(b.getAttribute('aria-controls')).hidden = true;
    });
    botones.forEach((b) => {
        const lista = document.getElementById(b.getAttribute('aria-controls'));
        b.addEventListener('click', () => {
            const abrir = b.getAttribute('aria-expanded') !== 'true';
            cerrar(b);
            b.setAttribute('aria-expanded', String(abrir));
            lista.hidden = !abrir;
        });
        b.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); cerrar(b); b.setAttribute('aria-expanded', 'true'); lista.hidden = false; $('a', lista).focus(); }
        });
        lista.addEventListener('keydown', (e) => {
            const enlaces = $$('a', lista);
            const i = enlaces.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') { e.preventDefault(); enlaces[(i + 1) % enlaces.length].focus(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); enlaces[(i - 1 + enlaces.length) % enlaces.length].focus(); }
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const abierto = botones.find((b) => b.getAttribute('aria-expanded') === 'true');
        if (abierto) { cerrar(); abierto.focus(); }
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.submenu')) cerrar();
        if (e.target.closest('.nav a')) {
            cerrar();
            if (nav) nav.classList.remove('abierta');
            if (menu) menu.setAttribute('aria-expanded', 'false');
        }
    });

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Cifras que cuentan desde cero al aparecer: <b data-contar="200">200</b>
    function contar(el) {
        const meta = Number(el.dataset.contar);
        if (quieto || !meta) return;
        const inicio = performance.now(), dura = 1400;
        const final = meta.toLocaleString('es-CO');
        // Si el navegador pausa las animaciones (pestaña de fondo), el número igual termina en su valor real
        const tope = setTimeout(() => { el.textContent = final; }, dura + 250);
        const paso = () => {
            const p = Math.min(1, Math.max(0, (performance.now() - inicio) / dura));
            if (p >= 1) { clearTimeout(tope); el.textContent = final; return; }
            el.textContent = Math.round(meta * (1 - Math.pow(1 - p, 3))).toLocaleString('es-CO');
            requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
    }

    // Apariciones suaves y escalonadas al desplazarse; el trazo firme se dibuja al aparecer
    $$('.rejilla, .linea, .obtienes, .temas, .cascada').forEach((grupo) => {
        $$(':scope > .aparece', grupo).forEach((el, i) => el.style.setProperty('--i', i % 6));
    });
    const obs = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('visible');
        $$('[data-contar]', e.target).forEach(contar);
        if (e.target.matches('[data-contar]')) contar(e.target);
        obs.unobserve(e.target);
    }), { rootMargin: '0px 0px -8% 0px' }) : null;
    $$('.aparece, .trazo, [data-contar]').forEach((el) => (obs ? obs.observe(el) : el.classList.add('visible')));

    // Hojas flotantes: <div class="hojas-flotantes" data-hojas="7"></div>
    const COLORES = ['var(--menta)', 'var(--durazno)', 'var(--coral)', 'var(--mantequilla)', 'var(--lavanda)'];
    $$('[data-hojas]').forEach((caja, n) => {
        const total = Number(caja.dataset.hojas) || 6;
        let semilla = n * 97 + 13;
        const azar = () => { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };
        for (let i = 0; i < total; i++) {
            const h = document.createElement('span');
            h.style.cssText = `left:${(4 + azar() * 90).toFixed(1)}%;top:${(6 + azar() * 80).toFixed(1)}%;--t:${(.7 + azar() * 1.1).toFixed(2)}rem;--c:${caja.dataset.color || COLORES[i % COLORES.length]};--g:${Math.round(azar() * 360)}deg;--d:${(11 + azar() * 9).toFixed(1)}s;--r:-${(azar() * 10).toFixed(1)}s`;
            caja.appendChild(h);
        }
    });

    // Fotos con un desplazamiento leve al bajar (solo con mouse y si se permite el movimiento)
    const fotos = $$('.hoja, .hoja-inv').filter((f) => f.querySelector('img'));
    if (!quieto && fotos.length && window.matchMedia('(pointer: fine)').matches) {
        fotos.forEach((f) => f.classList.add('paralaje'));
        let pendiente = false;
        const mover = () => {
            pendiente = false;
            const alto = innerHeight;
            fotos.forEach((f) => {
                const r = f.getBoundingClientRect();
                if (r.bottom < 0 || r.top > alto) return;
                const centro = (r.top + r.height / 2 - alto / 2) / alto;
                f.style.setProperty('--desfase', `${(centro * -18).toFixed(1)}px`);
            });
        };
        addEventListener('scroll', () => { if (!pendiente) { pendiente = true; requestAnimationFrame(mover); } }, { passive: true });
        mover();
    }

    // Chispa al hacer clic: un aro y pétalos de un color distinto al del elemento tocado
    if (!quieto) {
        const colorPara = (el) => {
            if (!el) return ['var(--coral)', 'var(--menta)'];
            if (el.matches('.btn-primario, .bg-coral, .bg-durazno')) return ['var(--mantequilla)', 'var(--menta)'];
            if (el.matches('.btn-bosque, .btn-claro, .cta-banda *, .territorio *')) return ['var(--durazno)', 'var(--mantequilla)'];
            if (el.matches('.bg-menta, .bg-agua')) return ['var(--coral)', 'var(--durazno)'];
            return ['var(--coral)', 'var(--menta)'];
        };
        document.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const blanco = e.target.closest('a, button, summary, label, .tema, .otra-ruta');
            if (!blanco) return;
            const [c1, c2] = colorPara(blanco);
            const aro = document.createElement('span');
            aro.className = 'chispa';
            aro.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;--c:${c1}`;
            document.body.appendChild(aro);
            for (let i = 0; i < 6; i++) {
                const p = document.createElement('span');
                const ang = (Math.PI * 2 * i) / 6 + Math.random() * .5;
                const dist = 22 + Math.random() * 14;
                p.className = 'petalo';
                p.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;--c:${i % 2 ? c1 : c2};--x:${(Math.cos(ang) * dist).toFixed(1)}px;--y:${(Math.sin(ang) * dist).toFixed(1)}px;--g:${Math.round(ang * 57)}deg`;
                document.body.appendChild(p);
                setTimeout(() => p.remove(), 800);
            }
            setTimeout(() => aro.remove(), 650);
        });
    }
})();
