/* ═══════════════════════════════════════════════════════════════
   THE MOONSHOT FACTORY — measurement + consent
   ═══════════════════════════════════════════════════════════════
   Loads in <head> BEFORE gtag.js so Consent Mode defaults are on
   the dataLayer first; GA4 then honours them from its very first
   ping. Everything is denied until the visitor says otherwise, so
   no identifying cookie is written on a cold visit.

   REGION SCOPE: defaults are denied worldwide. To collect by
   default outside the EEA/UK/CH instead (more data, still lawful
   in most of the world), give the default() call a `region` array
   and add a second granted default for everywhere else — see the
   note beside DEFAULTS below.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const GA_ID   = 'G-56K5LTFR01';
  const STORE   = 'tmf-consent';        // localStorage key
  const MAXAGE  = 183;                  // days before we ask again

  /* ── dataLayer + gtag shim ─────────────────────────────────
     Defined by hand rather than waiting on gtag.js so calls made
     during head parsing are queued in the right order.          */
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  /* ── stored decision ──────────────────────────────────────── */
  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(STORE));
      if (!v || !v.at || !v.choice) return null;
      // a decision expires so the banner re-asks rather than
      // assuming consent given half a year ago still holds
      return (Date.now() - v.at) / 864e5 > MAXAGE ? null : v;
    } catch { return null; }
  };
  const write = choice => {
    try { localStorage.setItem(STORE, JSON.stringify({choice, at: Date.now()})); } catch {}
  };

  /* Global Privacy Control: a browser-level opt-out signal. Where
     it's set we treat the answer as already given (no) and never
     show the banner — asking again would be ignoring it. */
  const gpc = navigator.globalPrivacyControl === true;

  const stored  = read();
  const decided = gpc ? 'denied' : stored && stored.choice;

  /* ── Consent Mode v2 defaults ─────────────────────────────── */
  const DEFAULTS = {
    ad_storage:            'denied',
    ad_user_data:          'denied',
    ad_personalization:    'denied',
    analytics_storage:     'denied',
    functionality_storage: 'granted',  // no tracking role; keeps the site usable
    security_storage:      'granted',  // abuse prevention, exempt from consent
    wait_for_update:       500         // ms to hold pings for an update() below
  };
  gtag('consent', 'default', DEFAULTS);

  /* A returning visitor's answer is replayed immediately, still
     ahead of gtag.js, so their first pageview lands correctly. */
  const grants = granted => ({
    ad_storage:         granted ? 'granted' : 'denied',
    ad_user_data:       granted ? 'granted' : 'denied',
    ad_personalization: granted ? 'granted' : 'denied',
    analytics_storage:  granted ? 'granted' : 'denied'
  });
  if (decided) gtag('consent', 'update', grants(decided === 'granted'));

  /* ── GA4 ───────────────────────────────────────────────────
     Loaded even while denied: Consent Mode downgrades it to
     cookieless pings, which still give aggregate traffic without
     storing anything on the device.                             */
  gtag('js', new Date());
  gtag('config', GA_ID, {
    anonymize_ip: true,
    // the docbar carries a page identity the URL doesn't; keeps
    // reports readable while the site is still all .html files
    page_title: document.title
  });

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  /* ── event helper ─────────────────────────────────────────
     Exposed for site.js. Safe to call before gtag.js arrives —
     dataLayer buffers it.                                       */
  window.tmfTrack = (name, params) => gtag('event', name, params || {});

  /* ── consent-gated work ───────────────────────────────────
     Anything that writes a non-essential cookie registers here
     instead of loading itself; the callback runs only once the
     visitor has actually allowed it (now or on a later visit).   */
  const hooks = [];
  let allowed = decided === 'granted';
  window.tmfOnConsent = fn => { allowed ? fn() : hooks.push(fn); };
  const release = () => { allowed = true; hooks.splice(0).forEach(fn => fn()); };

  const ready = fn => {
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  /* ── banner ────────────────────────────────────────────────
     Injected from JS so the markup lives in one place instead of
     six pages, and so visitors who already answered never pay
     for the DOM at all.                                         */
  const mount = () => {
    if (decided) return;

    const el = document.createElement('div');
    el.className = 'consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-labelledby', 'consentTitle');
    el.innerHTML =
      '<div class="consent-card">' +
        '<div class="consent-copy">' +
          // not "Telemetry" — the homepage already stamps a section
          // with that word and the two read as one heading
          '<p class="stamp-label" id="consentTitle">Cookie Notice</p>' +
          '<p>We use Google Analytics to see which pages earn their keep. ' +
          'It sets a cookie and is off until you allow it. Decline and the ' +
          'site works exactly the same, minus the cookie.</p>' +
        '</div>' +
        '<div class="consent-acts">' +
          '<button class="btn" type="button" data-consent="granted">Allow</button>' +
          '<button class="btn btn-o" type="button" data-consent="denied">Decline</button>' +
        '</div>' +
      '</div>';

    const answer = choice => {
      write(choice);
      gtag('consent', 'update', grants(choice === 'granted'));
      gtag('event', 'consent_choice', {choice});
      if (choice === 'granted') release();
      el.classList.add('out');
      // let the slide-out finish before the node goes
      el.addEventListener('transitionend', () => el.remove(), {once: true});
      setTimeout(() => el.remove(), 600);
    };

    el.querySelectorAll('[data-consent]').forEach(b =>
      b.addEventListener('click', () => answer(b.dataset.consent)));

    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
  };

  ready(mount);

  /* ── generic engagement signals ───────────────────────────
     Page-agnostic, so they live here rather than in site.js.    */
  ready(() => {
    /* outbound clicks — GA4's enhanced measurement records these
       too, but flattened into `click`; a named event keeps
       LinkedIn vs Clutch vs Maps separable in reports */
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="http"]');
      if (!a || a.hostname === location.hostname) return;
      tmfTrack('outbound_click', {
        link_domain: a.hostname,
        link_url: a.href,
        link_text: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 80)
      });
    }, {passive: true});

    /* scroll depth — GA4 only fires at 90% on its own, which
       can't tell a bounce from a considered read */
    const marks = [25, 50, 75, 100], hit = new Set();
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - innerHeight;
      if (max <= 0) return;
      const pct = Math.min(100, Math.round((h.scrollTop || document.body.scrollTop) / max * 100));
      marks.forEach(m => {
        if (pct >= m && !hit.has(m)) {
          hit.add(m);
          tmfTrack('scroll_depth', {percent: m});
        }
      });
      if (hit.size === marks.length) removeEventListener('scroll', onScroll);
    };
    addEventListener('scroll', onScroll, {passive: true});
  });
})();
