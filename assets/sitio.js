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

    // Apariciones suaves al desplazarse
    const obs = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' }) : null;
    $$('.aparece').forEach((el) => (obs ? obs.observe(el) : el.classList.add('visible')));
})();
