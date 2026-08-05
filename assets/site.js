/* ═══════════════════════════════════════════════════════════════
   THE MOONSHOT FACTORY — shared behaviour
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  // analytics.js may be blocked or absent; measurement is never a
  // reason for the site itself to stop working
  const track = (n, p) => window.tmfTrack && window.tmfTrack(n, p);

  /* ── mobile menu ───────────────────────────────────────── */
  const burger = $('#burger'), navLinks = $('#navLinks');
  if (burger && navLinks) {
    const setOpen = on => {
      navLinks.classList.toggle('open', on);
      burger.setAttribute('aria-expanded', String(on));
    };
    burger.addEventListener('click', () => setOpen(!navLinks.classList.contains('open')));
    // any navigation closes it; so does Escape
    navLinks.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
    addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  }

  /* ── reveal on scroll ──────────────────────────────────── */
  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {threshold: .1, rootMargin: '0px 0px -50px'});
  $$('.rv').forEach(el => io.observe(el));

  /* ── spec-sheet counters ───────────────────────────────── */
  const fmt = n => n.toLocaleString('en-US');
  const cio = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, to = +el.dataset.to, sfx = el.dataset.suffix || '';
      cio.unobserve(el);
      if (reduce) { el.textContent = fmt(to) + sfx; return; }
      const dur = 1500, t0 = performance.now();
      const step = t => {
        const p = Math.min((t - t0) / dur, 1);
        el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3)))) + sfx;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, {threshold: .5});
  $$('[data-to]').forEach(el => cio.observe(el));

  /* ── checklist ticks ───────────────────────────────────── */
  const tio = new IntersectionObserver(es => {
    es.forEach((e, i) => {
      if (!e.isIntersecting) return;
      setTimeout(() => e.target.classList.add('tick'), i * 90);
      tio.unobserve(e.target);
    });
  }, {threshold: .9});
  $$('.cr').forEach(el => tio.observe(el));

  /* ── parts bin marquee ─────────────────────────────────── */
  const t1 = $('#t1'), t2 = $('#t2');
  if (t1 && t2) {
    const parts = [
      ...Array.from({length: 19}, (_, i) => i === 6 ? null : `assets/tech/tech-${i}.svg`).filter(Boolean),
      'assets/tech/ai-openai.svg', 'assets/tech/ai-mistral.svg', 'assets/tech/ai-langchain.svg',
      'assets/tech/ai-llama2.svg', 'assets/tech/ai-haystack.svg', 'assets/tech/ai-pinecone.svg'
    ];
    const half = Math.ceil(parts.length / 2);
    const fill = (track, list) => {
      // duplicated once so the -50% translate loops seamlessly
      [...list, ...list].forEach(src => {
        const d = document.createElement('div');
        d.className = 'part';
        d.innerHTML = `<img src="${src}" alt="" loading="lazy">`;
        track.appendChild(d);
      });
    };
    fill(t1, parts.slice(0, half));
    fill(t2, parts.slice(half));
  }

  /* ── rocket ────────────────────────────────────────────── */
  const rk = $('#rk');
  if (rk) rk.addEventListener('click', () => {
    if (rk.classList.contains('launch')) return;
    rk.classList.add('launch');
    setTimeout(() => rk.classList.remove('launch'), 1400);
  });

  /* ── HubSpot visitor tracking ──────────────────────────────
     Separate from the forms script below: this is what ties a
     submission to its original source inside the CRM. It writes
     the hubspotutk cookie, so it waits for consent. The form
     still works without it — it just arrives unattributed.       */
  if (window.tmfOnConsent) window.tmfOnConsent(() => {
    const s = document.createElement('script');
    s.id = 'hs-script-loader';
    s.async = true;
    s.defer = true;
    s.src = 'https://js.hs-scripts.com/22649393.js';
    document.head.appendChild(s);
  });

  /* ── contact modal + HubSpot ───────────────────────────── */
  const modal = $('#contactModal');
  if (modal) {
    const HS = {region: 'na1', portalId: '22649393', formId: '67e35710-d14e-4d9a-86f4-d172b9ff0bd2'};
    let loaded = false;

    const mountForm = () => {
      if (loaded) return;
      loaded = true;
      const target = $('#hs-form');
      const build = () => {
        if (!window.hbspt) return fail();
        target.innerHTML = '';
        window.hbspt.forms.create({...HS, target: '#hs-form'});
      };
      const fail = () => {
        target.innerHTML = '<p class="hs-fallback">The form could not load. Reach us on ' +
          '<a href="https://www.linkedin.com/company/themoonshotfactory/" target="_blank" rel="noopener">LinkedIn</a> instead.</p>';
      };
      if (window.hbspt) return build();
      const s = document.createElement('script');
      s.src = 'https://js.hsforms.net/forms/v2.js';
      s.charset = 'utf-8';
      s.onload = build;
      s.onerror = fail;
      document.head.appendChild(s);
    };

    const open = e => {
      if (e) e.preventDefault();
      mountForm();
      modal.showModal();
      document.body.style.overflow = 'hidden';
      // funnel step one: which CTA on which page started the enquiry
      const src = e && e.currentTarget;
      track('contact_open', {
        cta_text: src ? (src.textContent || '').trim().slice(0, 60) : 'unknown',
        page_path: location.pathname
      });
    };
    const close = () => { modal.close(); document.body.style.overflow = ''; };

    /* the conversion itself. HubSpot's v2 embed reports back by
       postMessage from its iframe, which is the only reliable
       submit signal — the form's own DOM is cross-origin.
       The origin check matters: without it any frame on the page
       could post a fake callback and inflate the lead count. */
    const HS_ORIGINS = /(^|\.)(hsforms\.com|hsforms\.net|hubspot\.com)$/;
    addEventListener('message', e => {
      let host;
      try { host = new URL(e.origin).hostname; } catch { return; }
      if (!HS_ORIGINS.test(host)) return;
      const d = e.data;
      if (!d || d.type !== 'hsFormCallback') return;
      if (d.eventName === 'onFormSubmitted') {
        track('generate_lead', {form_id: d.id || HS.formId, page_path: location.pathname});
      } else if (d.eventName === 'onFormReady') {
        track('contact_form_ready', {form_id: d.id || HS.formId});
      }
    });

    $$('[data-contact]').forEach(el => el.addEventListener('click', open));
    $$('[data-close]', modal).forEach(el => el.addEventListener('click', close));
    modal.addEventListener('close', () => { document.body.style.overflow = ''; });
    // click outside the card dismisses
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
  }
})();
