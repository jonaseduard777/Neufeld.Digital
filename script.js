// Termin-Box-Button: nur einblenden, wenn die lokale Inbox erreichbar ist.
// Auf der öffentlich gehosteten Webseite ist localhost:3200 nicht erreichbar
// → Button bleibt unsichtbar. Lokal (bei dir) auf dem Mac → erscheint.
(() => {
  const fab = document.getElementById('terminBoxFab');
  if (!fab) return;
  fetch('http://localhost:3200/api/termine', { method: 'GET', cache: 'no-store' })
    .then(r => { if (r.ok) fab.hidden = false; })
    .catch(() => {});
})();

// Mobile-Menü (Drawer)
const toggle = document.querySelector('.nav-toggle');
const drawer = document.getElementById('navDrawer');
const backdrop = document.getElementById('navBackdrop');
const drawerClose = document.querySelector('.nav-drawer-close');

const openNav = () => {
  if (!drawer) return;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  toggle?.setAttribute('aria-expanded', 'true');
  if (backdrop) { backdrop.hidden = false; requestAnimationFrame(() => backdrop.classList.add('show')); }
  document.body.classList.add('nav-open');
};
const closeNav = () => {
  if (!drawer) return;
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  toggle?.setAttribute('aria-expanded', 'false');
  if (backdrop) {
    backdrop.classList.remove('show');
    setTimeout(() => { backdrop.hidden = true; }, 260);
  }
  document.body.classList.remove('nav-open');
};
toggle?.addEventListener('click', () => {
  if (drawer?.classList.contains('open')) closeNav(); else openNav();
});
drawerClose?.addEventListener('click', closeNav);
backdrop?.addEventListener('click', closeNav);
drawer?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', closeNav);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && drawer?.classList.contains('open')) closeNav();
});

// Jahr im Footer
document.getElementById('year').textContent = new Date().getFullYear();

// Process-Cards · Klick auf "Mehr erfahren" expandiert die Beschreibung
document.querySelectorAll('.process-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('aria-controls');
    const desc = id ? document.getElementById(id) : null;
    if (!desc) return;
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    const label = btn.querySelector('.process-toggle-text');

    if (expanded) {
      // Schließen
      desc.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      if (label) label.textContent = 'Mehr erfahren';
      // Nach Animation hidden setzen, damit kein Platz reserviert bleibt
      const onEnd = (e) => {
        if (e.target !== desc) return;
        desc.hidden = true;
        desc.removeEventListener('transitionend', onEnd);
      };
      desc.addEventListener('transitionend', onEnd);
    } else {
      // Öffnen
      desc.hidden = false;
      // Force reflow, damit die "is-open"-Klasse animiert greift
      void desc.offsetHeight;
      desc.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      if (label) label.textContent = 'Weniger';
    }
  });
});

// Termin-Buchung — postet an die eigene Jonas-Eduard-Termin-Inbox (Port 3200).
const TERMINE_API = 'http://localhost:3200/api/bookings';
const bookingForm = document.getElementById('bookingForm');
const bookingSuccess = document.getElementById('bookingSuccess');
bookingForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!bookingForm.checkValidity()) {
    bookingForm.reportValidity();
    return;
  }
  const fd = new FormData(bookingForm);
  if (fd.get('_honey')) return; // Honeypot
  const payload = Object.fromEntries(fd.entries());
  payload.source = 'jonas-digital';

  // Warenkorb-Auswahl vor die Nachricht stellen, damit Jonas direkt sieht,
  // was die Person konkret will.
  const cartMessage = (typeof JECart !== 'undefined') ? JECart.asMessage() : '';
  if (cartMessage) {
    const userMsg = (payload.message || '').trim();
    payload.message = userMsg ? `${cartMessage}\n\n${userMsg}` : cartMessage;
  }

  const fields = bookingForm.querySelectorAll('input, select, textarea, button[type="submit"]');
  fields.forEach(f => f.disabled = true);
  const btn = bookingForm.querySelector('button[type="submit"]');
  const btnText = btn?.textContent;
  if (btn) btn.textContent = 'Wird gesendet …';

  try {
    const res = await fetch(TERMINE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Senden fehlgeschlagen');

    if (btn) btn.textContent = 'Wurde gesendet ✓';
    if (bookingSuccess) {
      bookingSuccess.hidden = false;
      bookingSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Auswahl nach erfolgreicher Buchung leeren
    if (typeof JECart !== 'undefined') JECart.clear();
  } catch (err) {
    fields.forEach(f => f.disabled = false);
    if (btn && btnText) btn.textContent = btnText;
    alert('Buchung konnte nicht gesendet werden:\n\n' + err.message + '\n\nLäuft der Termine-Server (Admin öffnen.command)?');
    console.error('Booking error:', err);
  }
});

// Preis-Dialog: Leistungen mit Erklärung & Preis
const PRICE_DATA = {
  'web-design': {
    eyebrow: 'Website',
    title: 'Design, das deine Marke zeigt',
    desc: 'Ein Design, das deine Firma sofort hochwertig wirken lässt — abgestimmt auf Farben, Schrift und Tonalität deiner Marke. Klar, ruhig, einladend. Kein Baukasten-Look.',
    once: '1.500 – 2.500 €',
    monthly: '–',
    note: ''
  },
  'web-seo': {
    eyebrow: 'Website',
    title: 'Gefunden werden bei Google',
    desc: 'Damit dich Kunden in Dorsten und Umgebung finden, wenn sie nach deiner Leistung suchen. Saubere Technik, sinnvolle Keywords, lokale Optimierung.',
    once: '600 – 900 €',
    monthly: '150 – 300 €',
    note: ''
  },
  'web-maps': {
    eyebrow: 'Website',
    title: 'Sichtbar auf Google Maps',
    desc: 'Dein Google-Business-Profil professionell eingerichtet: Fotos, Beschreibung, Öffnungszeiten, Bewertungen. Damit du in der Karte direkt auffällst.',
    once: '250 – 400 €',
    monthly: '–',
    note: ''
  },
  'web-mobile': {
    eyebrow: 'Website',
    title: 'Schnell, mobil & DSGVO-sicher',
    desc: 'Deine Seite lädt blitzschnell, sieht auf jedem Handy gut aus und ist rechtlich sauber — Impressum, Datenschutz, Cookie-Hinweis inklusive.',
    once: 'im Design enthalten',
    monthly: '–',
    note: ''
  },
  'web-forms': {
    eyebrow: 'Website',
    title: 'Anfragen direkt ins Postfach',
    desc: 'Anfragen kommen direkt in dein E-Mail-Postfach. Mit Spam-Schutz, Pflichtfeldern und automatischer Bestätigung an den Kunden.',
    once: '300 – 500 €',
    monthly: '–',
    note: ''
  },
  'web-content': {
    eyebrow: 'Website',
    title: 'Texte, Bilder & Logo',
    desc: 'Ich schreibe die Texte mit dir gemeinsam, suche passende Bilder aus und passe dein Logo (oder erstelle ein neues, schlichtes) an die Website an.',
    once: '500 – 1.200 €',
    monthly: '–',
    note: ''
  },
  'web-hosting': {
    eyebrow: 'Website',
    title: 'Hosting, Pflege & Support',
    desc: 'Deine Website läuft auf schnellen Servern, ich kümmere mich um Updates, Backups und Sicherheit. Bei Fragen oder kleinen Änderungen bin ich persönlich erreichbar.',
    once: '–',
    monthly: '49 – 89 €',
    note: ''
  },

  'tool-booking': {
    eyebrow: 'Tool',
    title: 'Termine online buchen',
    desc: 'Kunden buchen Termine direkt online — du siehst alles in einem Kalender. Mit automatischer Bestätigung, Erinnerung und Sperrzeiten.',
    once: '800 – 1.500 €',
    monthly: '29 – 49 €',
    note: ''
  },
  'tool-whatsapp': {
    eyebrow: 'Tool',
    title: 'WhatsApp rund um die Uhr',
    desc: 'Antwortet automatisch auf häufige Fragen, nimmt Anfragen entgegen und leitet wichtige Nachrichten an dich weiter. Rund um die Uhr, ohne dass du immer aufs Handy schauen musst.',
    once: '900 – 1.800 €',
    monthly: '79 – 149 €',
    note: ''
  },
  'tool-aicall': {
    eyebrow: 'Tool',
    title: 'KI nimmt Anrufe entgegen',
    desc: 'Wenn du nicht abnehmen kannst, geht eine freundliche KI-Stimme ran, nimmt Termine entgegen, beantwortet Fragen und schickt dir alles als Übersicht. Klingt natürlich, nicht wie ein Roboter.',
    once: '1.200 – 2.200 €',
    monthly: '99 – 199 €',
    note: ''
  },
  'tool-sms': {
    eyebrow: 'Tool',
    title: 'SMS, wenn was reinkommt',
    desc: 'Sobald eine Anfrage reinkommt, bekommst du sofort eine SMS aufs Handy — egal wo du gerade bist. Keine Anfrage geht verloren.',
    once: '300 – 600 €',
    monthly: '19 – 39 €',
    note: ''
  },
  'tool-email': {
    eyebrow: 'Tool',
    title: 'E-Mails & Dokumente automatisch',
    desc: 'Rechnungen, Bestätigungen, Erinnerungen, PDF-Verträge — automatisch erstellt und verschickt. Spart dir täglich Zeit.',
    once: '1.500 – 3.500 €',
    monthly: '49 – 99 €',
    note: ''
  },
  'tool-dashboard': {
    eyebrow: 'Tool',
    title: 'Alles auf einen Blick',
    desc: 'Eine Übersicht, die genau zu deiner Firma passt: Termine, Umsätze, Anfragen, offene Aufgaben — auf einen Blick. Kein Excel mehr.',
    once: '1.200 – 2.500 €',
    monthly: '29 – 59 €',
    note: ''
  },
  'tool-ai': {
    eyebrow: 'Tool',
    title: 'KI für smartere Abläufe',
    desc: 'KI, die für dich Texte schreibt, E-Mails vorsortiert, Termine vorschlägt oder Anfragen kategorisiert. Wir bauen genau das, was bei dir am meisten Zeit frisst.',
    once: '1.500 – 4.000 €',
    monthly: '79 – 199 €',
    note: ''
  },

  'web-package': {
    eyebrow: 'Paketpreis',
    title: 'Die komplette Website',
    desc: 'Alle Website-Leistungen in einem Paket: Design, SEO, Google Maps, mobil & DSGVO-konform, Formulare, Texte/Bilder/Logo. Eine Website, die direkt einsatzbereit ist.',
    once: '2.900 – 4.500 €',
    monthly: 'ab 49 €',
    note: 'Monatlich für Hosting, Pflege & Support nach Launch.'
  },
  'tool-package': {
    eyebrow: 'Paketpreis',
    title: 'Das passende Tool-Paket',
    desc: 'Eine sinnvolle Kombination aus mehreren Tools — z. B. Buchung, WhatsApp- oder E-Mail-Automatisierung und ein Dashboard. Genau auf deine Abläufe zugeschnitten.',
    once: 'ab 4.900 €',
    monthly: 'ab 149 €',
    note: 'Genauer Preis hängt vom Umfang ab — wir besprechen das in Ruhe.'
  },
  'bundle-package': {
    eyebrow: 'Bundle-Empfehlung',
    title: 'Website & Tools — aus einer Hand',
    desc: 'Für Kanzleien & Praxen: eine repräsentative Website, kombiniert mit den wichtigsten Tools (z. B. Buchung, WhatsApp- oder Anruf-Assistent, Automatisierungen). Aus einer Hand, sauber verzahnt — Außenauftritt und interne Abläufe in einem Paket.',
    once: '8.000 – 12.000 €',
    monthly: 'ca. 200 – 250 €',
    note: '12 Monate Mindestlaufzeit. Genauer Preis hängt vom Umfang ab — wir kalkulieren das im Erstgespräch verbindlich.'
  }
};

const JECart = (() => {
  const STORAGE_KEY = 'je-cart-v1';

  // --- State ---
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch (_) { cart = []; }

  const listeners = new Set();

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (_) {}
  }
  function emit() {
    listeners.forEach((fn) => { try { fn(cart.slice()); } catch (_) {} });
  }

  return {
    has(key) { return cart.includes(key); },
    items() { return cart.slice(); },
    add(key) {
      if (!PRICE_DATA[key] || cart.includes(key)) return;
      cart.push(key);
      persist(); emit();
    },
    remove(key) {
      const i = cart.indexOf(key);
      if (i === -1) return;
      cart.splice(i, 1);
      persist(); emit();
    },
    toggle(key) {
      if (cart.includes(key)) this.remove(key);
      else this.add(key);
    },
    clear() {
      if (cart.length === 0) return;
      cart = [];
      persist(); emit();
    },
    subscribe(fn) { listeners.add(fn); fn(cart.slice()); return () => listeners.delete(fn); },
    asMessage() {
      if (cart.length === 0) return '';
      const lines = cart.map((key) => {
        const d = PRICE_DATA[key];
        if (!d) return null;
        return `• ${d.title}`;
      }).filter(Boolean);
      return `Meine Auswahl (${cart.length}):\n${lines.join('\n')}`;
    },
  };
})();

// --- Preis-Dialog ---
(() => {
  const dialog = document.getElementById('priceDialog');
  if (!dialog) return;

  const elEyebrow = document.getElementById('priceDialogEyebrow');
  const elTitle = document.getElementById('priceDialogTitle');
  const elDesc = document.getElementById('priceDialogDesc');
  const btnAdd = document.getElementById('priceDialogAdd');

  let lastFocused = null;
  let currentKey = null;

  function syncAddBtn() {
    if (!btnAdd || !currentKey) return;
    btnAdd.classList.toggle('is-selected', JECart.has(currentKey));
  }

  function openDialog(key, triggerEl) {
    const data = PRICE_DATA[key];
    if (!data) return;
    currentKey = key;
    elEyebrow.textContent = data.eyebrow || 'Leistung';
    elTitle.textContent = data.title || '';
    elDesc.textContent = data.desc || '';
    if (btnAdd) btnAdd.dataset.featureKey = key;
    syncAddBtn();
    lastFocused = triggerEl || document.activeElement;
    dialog.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => { btnAdd?.focus(); });
  }

  function closeDialog() {
    dialog.hidden = true;
    currentKey = null;
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  document.querySelectorAll('[data-feature]').forEach((el) => {
    el.addEventListener('click', () => openDialog(el.dataset.feature, el));
    if (el.tagName !== 'BUTTON') {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDialog(el.dataset.feature, el);
        }
      });
    }
  });

  dialog.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeDialog();
  });

  document.addEventListener('keydown', (e) => {
    if (!dialog.hidden && e.key === 'Escape') closeDialog();
  });

  btnAdd?.addEventListener('click', () => {
    if (!currentKey) return;
    JECart.toggle(currentKey);
    syncAddBtn();
  });

  // Re-sync dialog button when cart changes externally
  JECart.subscribe(() => syncAddBtn());
})();

// --- Auswahl-UI: Markierungen auf Punkten + Box im Termin-Formular ---
(() => {
  const selBox = document.getElementById('terminSelection');
  const selList = document.getElementById('terminSelectionList');
  const selCount = document.getElementById('terminSelectionCount');
  const selClear = document.getElementById('terminSelectionClear');

  function renderInlineList(items) {
    if (!selList) return;
    selList.innerHTML = '';
    items.forEach((key) => {
      const d = PRICE_DATA[key];
      if (!d) return;
      const li = document.createElement('li');

      const title = document.createElement('span');
      title.className = 'termin-selection-item-title';
      title.textContent = d.title;

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'termin-selection-remove';
      rm.setAttribute('aria-label', `«${d.title}» entfernen`);
      rm.textContent = '×';
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        JECart.remove(key);
      });

      li.appendChild(title);
      li.appendChild(rm);
      selList.appendChild(li);
    });
  }

  function update(items) {
    if (selBox && selCount) {
      selBox.hidden = items.length === 0;
      selCount.textContent = `(${items.length})`;
      renderInlineList(items);
    }
    document.querySelectorAll('[data-feature]').forEach((el) => {
      el.classList.toggle('is-selected', items.includes(el.dataset.feature));
    });
  }

  selClear?.addEventListener('click', () => JECart.clear());

  JECart.subscribe(update);
})();

// === Lucide Icons initialisieren ===
function initLucideIcons() {
  if (window.lucide) window.lucide.createIcons();
}
initLucideIcons();

// === Reload startet immer oben auf der Startseite ===
// Browser-Restore deaktivieren, Hash aus URL entfernen (sonst springt der
// Browser zur Section), und am Anfang hart auf 0 scrollen.
(() => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash) {
    history.replaceState(null, '', location.pathname + location.search);
  }
  const html = document.documentElement;
  const prevBehavior = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);
  window.addEventListener('load', () => window.scrollTo(0, 0), { once: true });
  setTimeout(() => { html.style.scrollBehavior = prevBehavior; }, 200);
})();

// === AOS — Scroll-Animationen ===
if (window.AOS) {
  window.AOS.init({
    duration: 700,
    easing: 'ease-out-cubic',
    once: true,
    offset: 80,
    disable: 'phone'
  });
}

// === GSAP — Hero-Eintrittsanimation ===
if (window.gsap) {
  const hero = document.querySelector('.hero');
  if (hero) {
    const tl = window.gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.hero-text .eyebrow', { y: 14, opacity: 0, duration: 0.5 })
      .from('.hero h1', { y: 28, opacity: 0, duration: 0.8 }, '-=0.3')
      .from('.hero .lead', { y: 18, opacity: 0, duration: 0.6 }, '-=0.45')
      .from('.hero-cta .btn', { y: 16, opacity: 0, duration: 0.45, stagger: 0.08 }, '-=0.35')
      .from('.hero-meta > div', { y: 14, opacity: 0, duration: 0.4, stagger: 0.08 }, '-=0.3')
      .from('.hero-visual', { x: 50, opacity: 0, duration: 0.9 }, '-=1.1');
  }
}

// === Apple Premium Upgrades 2026-05-19 ===
// 1. Scroll-Progress-Bar (gold hairline oben)
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.prepend(bar);
  let ticking = false;
  const update = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    bar.style.setProperty('--scroll-progress', pct.toFixed(2) + '%');
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
})();

// 2. Magnetischer Hover für Primary-Buttons — deaktiviert (Button soll fix bleiben)

// 3. Word-Reveal für Section-Headlines (Apple-Editorial-Feeling)
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const headlines = document.querySelectorAll('.section-head h2, .about-text h2, .termin-info h2');
  headlines.forEach(h => {
    if (h.dataset.wordsSplit === 'true') return;
    const text = h.innerHTML;
    // Nur splitten, wenn keine komplexen Kinder (z.B. <br>) drin sind → einfach Text in Wörter
    const tmp = document.createElement('div');
    tmp.innerHTML = text;
    const safe = Array.from(tmp.childNodes).every(n =>
      n.nodeType === 3 || (n.nodeType === 1 && n.tagName === 'SPAN')
    );
    if (!safe) return;
    const words = tmp.textContent.trim().split(/\s+/);
    h.innerHTML = words.map(w => `<span class="word">${w}</span>`).join(' ');
    h.dataset.wordsSplit = 'true';
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const words = entry.target.querySelectorAll('.word');
        words.forEach((w, i) => {
          setTimeout(() => w.classList.add('is-revealed'), i * 60);
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('.section-head h2, .about-text h2, .termin-info h2').forEach(h => {
    observer.observe(h);
  });
})();

// 4. Subtle Parallax auf Hero-Visual (Mausbewegung)
(() => {
  if (matchMedia('(hover: none)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const visual = document.querySelector('.hero-visual');
  const hero = document.querySelector('.hero');
  if (!visual || !hero) return;
  let raf = null;
  hero.addEventListener('mousemove', (e) => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = hero.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 12;
      const y = ((e.clientY - r.top) / r.height - 0.5) * 8;
      visual.style.transform = `translate(${x}px, ${y}px)`;
    });
  });
  hero.addEventListener('mouseleave', () => {
    visual.style.transform = '';
  });
})();

// 5. Bewertungs-Dialog (Kunden können eine Bewertung hinterlassen)
(() => {
  const dialog = document.getElementById('reviewDialog');
  if (!dialog) return;

  const form = document.getElementById('reviewForm');
  const starRow = document.getElementById('reviewStarRow');
  const starsInput = document.getElementById('reviewStars');
  const statusEl = document.getElementById('reviewStatus');
  const submitBtn = document.getElementById('reviewSubmit');

  const setStars = (n) => {
    if (starsInput) starsInput.value = String(n);
    starRow?.querySelectorAll('.review-star').forEach((s) => {
      s.classList.toggle('is-on', Number(s.dataset.star) <= n);
    });
  };
  setStars(5);

  const openDialog = () => {
    if (statusEl) { statusEl.textContent = ''; statusEl.classList.remove('is-error', 'is-ok'); }
    try {
      if (typeof dialog.showModal === 'function' && !dialog.open) {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    } catch {
      dialog.setAttribute('open', '');
    }
    document.body.classList.add('review-open');
  };
  const closeDialog = () => {
    try { if (typeof dialog.close === 'function') dialog.close(); } catch {}
    dialog.removeAttribute('open');
    document.body.classList.remove('review-open');
  };

  // Event-Delegation: bindet zuverlässig, auch wenn der Button erst später im DOM steht
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('#reviewOpen');
    if (opener) { e.preventDefault(); openDialog(); return; }
    if (e.target.closest('[data-close-review]')) { e.preventDefault(); closeDialog(); return; }
    const star = e.target.closest('.review-star');
    if (star && dialog.contains(star)) { setStars(Number(star.dataset.star)); return; }
    if (e.target === dialog) { closeDialog(); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (dialog.open || dialog.hasAttribute('open'))) closeDialog();
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (form.querySelector('#reviewName')?.value || '').trim();
    const email = (form.querySelector('#reviewEmail')?.value || '').trim();
    const org = (form.querySelector('#reviewOrg')?.value || '').trim();
    const text = (form.querySelector('#reviewText')?.value || '').trim();
    const stars = Number(starsInput?.value) || 5;
    if (!name || !email || !text) {
      if (statusEl) { statusEl.textContent = 'Bitte Name, E-Mail und Bewertung ausfüllen.'; statusEl.classList.add('is-error'); }
      return;
    }
    if (submitBtn) submitBtn.disabled = true;
    if (statusEl) { statusEl.classList.remove('is-error', 'is-ok'); statusEl.textContent = 'Wird gesendet …'; }

    // Lokaler Fallback: speichert die Bewertung im Browser (localStorage),
    // damit sie auch ohne laufenden Node-Server sofort in der Liste erscheint.
    const saveLocally = () => {
      const review = {
        id: (crypto.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        createdAt: new Date().toISOString(),
        name, email, org, stars, text,
      };
      try {
        const raw = localStorage.getItem('je-reviews');
        const list = raw ? JSON.parse(raw) : [];
        list.push(review);
        localStorage.setItem('je-reviews', JSON.stringify(list));
      } catch (e) {
        console.warn('localStorage nicht verfügbar:', e);
      }
      return review;
    };

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, org, stars, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Senden fehlgeschlagen');
      if (statusEl) { statusEl.textContent = 'Danke! Deine Bewertung ist angekommen.'; statusEl.classList.add('is-ok'); }
      // Liste sofort aktualisieren, neue Bewertung hervorheben
      if (typeof window.JEReviews?.refresh === 'function') {
        window.JEReviews.refresh(data.review?.id);
      }
      form.reset();
      setStars(5);
      setTimeout(closeDialog, 1500);
    } catch (err) {
      console.warn('Review-API nicht erreichbar — speichere lokal im Browser:', err);
      const local = saveLocally();
      if (statusEl) {
        statusEl.textContent = 'Danke! Deine Bewertung ist gespeichert.';
        statusEl.classList.add('is-ok');
      }
      if (typeof window.JEReviews?.refresh === 'function') {
        window.JEReviews.refresh(local.id);
      }
      form.reset();
      setStars(5);
      setTimeout(closeDialog, 1500);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();

// === Apple-Animations-Layer (2026-05-19) ============================
const _reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 6. Number-Counter für Hero-Stats (zählen hoch, sobald sichtbar)
(() => {
  if (_reduceMotion) return;
  const items = document.querySelectorAll('.hero-apple-meta strong');
  if (!items.length) return;
  const parse = (txt) => {
    const m = String(txt).match(/(\d+)/);
    return m ? Number(m[1]) : null;
  };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const animate = (el) => {
    const original = el.textContent.trim();
    const target = parse(original);
    if (target === null) return;
    const suffix = original.replace(/\d+/, '');
    const start = performance.now();
    const duration = 1200;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const v = Math.round(target * easeOutCubic(t));
      el.textContent = v + suffix;
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = original;
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animate(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });
  items.forEach((el) => io.observe(el));
})();

// 7. Hero-Scroll-Parallax: Text wandert nach unten + faded weg
(() => {
  if (_reduceMotion) return;
  const hero = document.querySelector('.hero-apple');
  const text = document.querySelector('.hero-apple-text');
  if (!hero || !text) return;
  let ticking = false;
  const update = () => {
    const r = hero.getBoundingClientRect();
    const h = hero.offsetHeight || 1;
    const scrolled = Math.min(Math.max(-r.top / h, 0), 1);
    text.style.transform = `translate3d(0, ${scrolled * 60}px, 0)`;
    text.style.opacity = String(1 - scrolled * 0.85);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
})();

// 8. 3D-Tilt für Feature-Cards (Apple Pro-Page-Feeling)
(() => {
  if (_reduceMotion) return;
  if (matchMedia('(hover: none)').matches) return;
  const cards = document.querySelectorAll('.feature-card');
  cards.forEach((card) => {
    card.style.transformStyle = 'preserve-3d';
    card.style.willChange = 'transform';
    let raf = null;
    const onMove = (e) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        const rx = (-py * 5).toFixed(2);
        const ry = (px * 5).toFixed(2);
        card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translate3d(0, -2px, 0)`;
      });
    };
    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      card.style.transform = '';
    };
    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
  });
})();

// 9. Smooth-Scroll für interne Anker mit iOS-Easing
(() => {
  if (_reduceMotion) return;
  const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
  const scrollTo = (targetY, duration = 850) => {
    const startY = window.scrollY;
    const diff = targetY - startY;
    if (Math.abs(diff) < 4) { window.scrollTo(0, targetY); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      window.scrollTo(0, startY + diff * easeOutQuint(t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.length < 2) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    const offset = (document.querySelector('.navbar')?.offsetHeight || 0) + 12;
    const y = target.getBoundingClientRect().top + window.scrollY - offset;
    scrollTo(y);
    history.pushState(null, '', href);
  });
})();

// 10. Reveal-Animation für Bewertungs-Button (scale + fade beim Scroll)
(() => {
  if (_reduceMotion) return;
  const btn = document.getElementById('reviewOpen');
  if (!btn) return;
  btn.classList.add('is-pre-reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  io.observe(btn);
})();

// ============================================================
// 11. Page-Load Fade-In (kein Flash of Unstyled Content)
// ============================================================
(() => {
  document.body.classList.add('is-loading');
  const reveal = () => {
    requestAnimationFrame(() => {
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-loaded');
    });
  };
  if (document.readyState === 'complete') reveal();
  else window.addEventListener('load', reveal, { once: true });
})();

// ============================================================
// 12. Mouse-Spotlight für Feature-Cards (Cursor-folgender Glow)
// ============================================================
(() => {
  if (_reduceMotion) return;
  document.querySelectorAll('.feature-card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mouse-x', `${x}%`);
      card.style.setProperty('--mouse-y', `${y}%`);
    }, { passive: true });
  });
})();

// ============================================================
// 13. Universeller Reveal-on-Scroll (data-reveal Attribut)
//     Sections faden sanft ein, mit optional Stagger-Delay
// ============================================================
(() => {
  if (_reduceMotion) {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-revealed'));
    return;
  }
  // Automatisch alle Sections + section-heads + Cards mit data-reveal taggen
  const autoTargets = [
    '.section-head',
    '.feature-card',
    '.process-card',
    '.about-card',
    '.about-text',
    '.empfehlung-card',
    '.testimonial',
    '.termin-info',
    '.termin-form',
  ];
  autoTargets.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el, idx) => {
      // Skip wenn AOS schon die Animation übernimmt (vermeidet Doppel-Animation)
      if (el.hasAttribute('data-aos')) return;
      if (!el.hasAttribute('data-reveal')) {
        el.setAttribute('data-reveal', '');
        if (idx > 0 && (selector === '.feature-card' || selector === '.empfehlung-card' || selector === '.process-card')) {
          el.setAttribute('data-reveal-delay', String(Math.min(idx * 100, 300)));
        }
      }
    });
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
})();

// ============================================================
// 14. Logo-Magnetic-Hover (Maus zieht das Logo leicht an)
// ============================================================
(() => {
  if (_reduceMotion) return;
  const logo = document.querySelector('.navbar .logo .logo-mark');
  if (!logo) return;
  const parent = logo.closest('.logo');
  parent.addEventListener('mousemove', (e) => {
    const rect = parent.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
    logo.style.transform = `translate(${x * 3}px, ${y * 3}px)`;
    logo.style.transition = 'transform 80ms linear';
  });
  parent.addEventListener('mouseleave', () => {
    logo.style.transform = '';
    logo.style.transition = 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)';
  });
})();

// ============================================================
// 15. Navbar Hide-on-Scroll-Down, Show-on-Scroll-Up
// ============================================================
(() => {
  if (_reduceMotion) return;
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  let lastY = window.scrollY;
  let ticking = false;
  navbar.style.transition = 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)';
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const diff = y - lastY;
      // Nicht beim Drawer geöffnet, nicht ganz oben
      const drawerOpen = document.body.classList.contains('nav-open');
      if (!drawerOpen && y > 120) {
        if (diff > 6) {
          navbar.style.transform = 'translateY(-100%)';
        } else if (diff < -4) {
          navbar.style.transform = 'translateY(0)';
        }
      } else {
        navbar.style.transform = 'translateY(0)';
      }
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
})();

// ============================================================
// 16. Process-Card Smooth-Close-Other (Apple-Accordion-Verhalten)
//     Klick auf Toggle schließt alle anderen
// ============================================================
(() => {
  document.querySelectorAll('.process-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      if (!expanded) return; // wurde gerade geöffnet — andere schließen
      document.querySelectorAll('.process-toggle').forEach((other) => {
        if (other === btn) return;
        if (other.getAttribute('aria-expanded') === 'true') {
          other.click();
        }
      });
    });
  });
})();

// ============================================================
// 17. Bewertungen · Liste laden + bei vielen Reviews als Marquee
// ============================================================
window.JEReviews = (() => {
  const wrap = document.getElementById('testimonialsWrap');
  const track = document.getElementById('testimonialsTrack');
  const MARQUEE_THRESHOLD = 6; // ab 6 Reviews startet das Karussell

  if (!wrap || !track) return { refresh: () => {} };

  const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const initials = (name) => {
    const parts = String(name).trim().split(/\s+/);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const cardHTML = (r, freshId) => {
    const stars = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
    const fresh = freshId && r.id === freshId ? ' is-fresh' : '';
    return `
      <article class="review-card${fresh}" data-id="${escapeHtml(r.id)}">
        <div class="review-stars" aria-label="${r.stars} von 5 Sternen">${stars}</div>
        <p class="review-text">„${escapeHtml(r.text)}"</p>
        <footer class="review-meta">
          <div class="review-avatar" aria-hidden="true">${escapeHtml(initials(r.name))}</div>
          <div class="review-author">
            <span class="review-name">${escapeHtml(r.name)}</span>
            ${r.org ? `<span class="review-org">${escapeHtml(r.org)}</span>` : ''}
          </div>
        </footer>
      </article>`;
  };

  const applyMarquee = (count) => {
    const isMarquee = count >= MARQUEE_THRESHOLD;
    wrap.classList.toggle('is-marquee', isMarquee);
    if (isMarquee) {
      // Geschwindigkeit an Anzahl koppeln: ca. 7s pro Card
      const duration = Math.max(20, count * 7);
      wrap.style.setProperty('--marquee-duration', `${duration}s`);
      // Dupliziere die Cards damit der Loop nahtlos ist
      const original = track.innerHTML;
      track.innerHTML = original + original;
    }
  };

  const render = (reviews, freshId) => {
    if (!reviews.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    wrap.classList.remove('is-marquee');
    wrap.style.removeProperty('--marquee-duration');
    track.innerHTML = reviews.map((r) => cardHTML(r, freshId)).join('');
    applyMarquee(reviews.length);
  };

  let _cache = [];

  const readLocal = () => {
    try {
      const raw = localStorage.getItem('je-reviews');
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      // Neueste zuerst, gleiches Format wie der Server liefert
      return arr.slice().reverse().map((r) => ({
        id: r.id,
        name: r.name,
        org: r.org || '',
        stars: r.stars,
        text: r.text,
        createdAt: r.createdAt,
      }));
    } catch {
      return [];
    }
  };

  const merge = (server, local) => {
    // Lokale Bewertungen oben, dann Server-Bewertungen (ohne Duplikate per ID)
    const seen = new Set(local.map((r) => r.id));
    return [...local, ...server.filter((r) => !seen.has(r.id))];
  };

  const refresh = async (freshId) => {
    const local = readLocal();
    try {
      const res = await fetch('/api/reviews', { cache: 'no-store' });
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      const server = Array.isArray(data.reviews) ? data.reviews : [];
      _cache = merge(server, local);
    } catch {
      // Server nicht erreichbar — nur lokale Bewertungen zeigen
      _cache = local;
    }
    render(_cache, freshId);
  };

  // Initial laden
  refresh();

  return { refresh };
})();
