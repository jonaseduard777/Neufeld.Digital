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

// Lenis-Instanz (wird weiter unten initialisiert; hier deklariert für Scroll-Lock im Drawer)
let _lenis = null;

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
  _lenis?.stop();
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
  _lenis?.start();
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


// FAQ — Accordion (unabhängig, kein Auto-Close, gleiche Animationssprache)
// Robust: kein transitionend (das feuerte bei schnellem Wieder-Öffnen und
// versteckte die gerade geöffnete Antwort). Stattdessen ein abbrechbarer
// Timer, der nur versteckt, wenn wirklich noch geschlossen ist.
document.querySelectorAll('.faq-toggle').forEach((btn) => {
  const id = btn.getAttribute('aria-controls');
  const ans = id ? document.getElementById(id) : null;
  if (!ans) return;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';

    if (open) {
      // Schließen — sofort und ohne Nachlauf
      btn.setAttribute('aria-expanded', 'false');
      ans.classList.remove('is-open');
      ans.hidden = true;
    } else {
      // Öffnen
      ans.hidden = false;
      void ans.offsetHeight; // Reflow, damit 0fr→1fr animiert
      ans.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

// Termin-Buchung — Ziel je nach Umgebung:
// • Primär geht jede Buchung DIREKT an die Termin-Box (/api/bookings). Dort
//   landet sie als echter Termin (Posteingang + Kalender) und die Box schickt
//   selbst die Bestätigung an den Kunden + die Benachrichtigung an Jonas.
//     – Lokal (file:// oder localhost, Jonas am Mac) → http://localhost:3200
//     – Live (neufeld.digital / Vercel)             → https://termine.neufeld.digital
// • Fallback (nur live): Ist die Box mal nicht erreichbar, geht die Anfrage an
//   die Vercel-Serverless-Function /api/contact, die per Resend eine Mail an
//   kontakt@neufeld.digital schickt — so geht kein Lead verloren.
const BOOKING_ENV = (() => {
  const h = location.hostname;
  const local = location.protocol === 'file:' ||
    h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '';
  return {
    local,
    primary: local ? 'http://localhost:3200/api/bookings' : 'https://termine.neufeld.digital/api/bookings',
    // Fallback nur live sinnvoll (relativer Pfad läuft per file:// ins Leere).
    fallback: local ? null : '/api/contact',
  };
})();

// Sendet das Payload an ein Ziel und wirft bei nicht-ok/Netzfehler.
async function postBooking(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Senden fehlgeschlagen');
  return json;
}
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
  const cartMessage = (typeof NDCart !== 'undefined') ? NDCart.asMessage() : '';
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
    try {
      // Primär: direkt an die Termin-Box.
      await postBooking(BOOKING_ENV.primary, payload);
    } catch (primaryErr) {
      // Box nicht erreichbar → live auf die Resend-Mail ausweichen.
      console.warn('Box nicht erreichbar, Fallback auf /api/contact:', primaryErr.message);
      if (!BOOKING_ENV.fallback) throw primaryErr;
      await postBooking(BOOKING_ENV.fallback, payload);
    }

    if (btn) btn.textContent = 'Wurde gesendet ✓';
    if (bookingSuccess) {
      bookingSuccess.hidden = false;
      bookingSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Auswahl nach erfolgreicher Buchung leeren
    if (typeof NDCart !== 'undefined') NDCart.clear();
  } catch (err) {
    fields.forEach(f => f.disabled = false);
    if (btn && btnText) btn.textContent = btnText;
    alert('Anfrage konnte nicht gesendet werden:\n\n' + err.message + '\n\nBitte versuche es später nochmal oder schreib direkt an kontakt@neufeld.digital.');
    console.error('Booking error:', err);
  }
});

// Die fünf Leistungen. Ein Klick auf eine Karte öffnet den Dialog damit.
//
// `video` bleibt leer, bis der Clip fertig ist. Sobald eine Datei da ist,
// hier den Pfad eintragen (z. B. 'videos/arbeitsberichte.mp4') — der Dialog
// zeigt sie dann automatisch über dem Text an. Optional `poster` für das
// Standbild, das vor dem Abspielen zu sehen ist.
const PRICE_DATA = {

  'arbeitsberichte': {
    eyebrow: 'Werkzeug 01',
    title: 'Arbeitsberichte, die sich selbst schreiben',
    video: '',
    poster: '',
    desc: 'Der Bericht entsteht dort, wo die Arbeit passiert — nicht abends am Küchentisch. Der Monteur drückt auf Aufnahme und erzählt frei, was er gemacht hat, fotografiert den Zettel vom Kunden oder tippt drei Stichworte. Die KI hört zu und sortiert alles in den Auftragszettel: Kunde, Ort, Arbeiten, Material, Hinweise — dazu Anfang, Ende, Pause, Fahrtzeit und Baustelle als Felder, die sich vor dem Absenden noch korrigieren lassen. Was der Kollege vorher im Lager gescannt hat, steht als Materialzeile schon drin, mit Preis. Am Ende steht ein editierbarer Bericht mit deinem Firmenkopf: die KI schlägt vor, der Mensch entscheidet.',
    points: [
      'Erzählen, fotografieren oder tippen — die KI macht daraus den Bericht',
      'Material aus dem Lager steht schon drin, samt Kosten',
      'Fertiges A4-PDF mit Unterschriftsfeldern für Kunde und Monteur',
      'Auf Knopfdruck per Mail an Chef, Team und Kunde — Fotos im Anhang',
      'Zeiten, Fahrt und Baustelle wandern automatisch ins Betriebsbuch',
      'Notizblock für Kundenwünsche: Foto, Skizze, Diktat — auf jedem Gerät da',
      'Läuft im Browser auf jedem Handy, passwortgeschützt — nichts zu installieren',
    ],
    custom: 'Auftragszettel, Firmenkopf, Felder und Empfänger richte ich auf deinen Betrieb ein — bis der Bericht so aussieht, wie ihr ihn heute von Hand schreibt.',
  },

  'lager': {
    eyebrow: 'Werkzeug 02',
    title: 'Ein Lager, das mitzählt und selbst nachbestellt',
    video: '',
    poster: '',
    desc: 'Jeder Artikel bekommt einen QR-Aufkleber — den Etikettenbogen druckst du direkt aus der App. Material entnehmen heißt dann: normale Handy-Kamera auf den Aufkleber halten, „Entnehmen“ tippen, fertig. Keine App, kein Login, kein Weg zum Rechner. Vorher wählt der Kollege einmal seinen Namen und die Baustelle — das Handy merkt sich beides, und jede Buchung landet mit Zeit, Menge, Person und Baustelle im Verlauf. Fällt der Bestand auf den Mindestbestand, schreibt die KI die Bestellung und schickt sie an den hinterlegten Lieferanten. Erst wenn die Lieferung eingeräumt ist, kann derselbe Artikel wieder auslösen — doppelte Bestellungen gibt es nicht.',
    points: [
      'QR am Regal — die normale Handy-Kamera reicht, keine App nötig',
      'Die Bestellung schreibt sich selbst und geht an den Lieferanten raus',
      'Jede Entnahme hängt an Mitarbeiter und Baustelle — lückenlos',
      'Druckbare Material-Übersicht je Baustelle zum Abrechnen',
      'Einkaufs- und Verkaufspreis je Artikel — die Kosten stehen im Bericht',
      'Ein Bestand für alle: Büro, Laptop und Handy sehen dieselbe Zahl',
    ],
    custom: 'Artikelstamm, Mindestbestände, Lieferanten und der Text der Bestellmail werden auf euer Lager gestellt — genauso das Format der Etiketten.',
  },

  'betriebsbuch': {
    eyebrow: 'Werkzeug 04',
    title: 'Betriebsbuch — Stunden, Lohn, Rechnung',
    video: '',
    poster: '',
    desc: 'Stundenzettel abtippen fällt weg. Die Zeiten kommen direkt aus dem Arbeitsbericht oder sind in zehn Sekunden eingetragen; die gesetzliche Pause und die Anfahrt der Baustelle schlägt das Betriebsbuch von selbst vor. Den Rest rechnet es: Nacht-, Sonntags-, Feiertags- und Überstundenzuschläge, Bereitschaft mit Tagespauschale, dazu Urlaub und Krank. Die Feiertage kennt es, auch die beweglichen, und eine Schicht über Mitternacht rechnet es richtig. In der Übersicht steht pro Mitarbeiter, was du überweisen musst — daneben interne Kosten, Umsatz und Rohertrag. Aus einer Baustelle wird auf Knopfdruck die Kundenrechnung: Arbeitszeit und Material stehen als Positionen schon drin, mit fortlaufender Nummer. Weil es um Löhne geht, gibt der Server ohne Chef-PIN weder Gehälter noch Stammdaten heraus.',
    points: [
      'Zeiten kommen automatisch aus dem Arbeitsbericht',
      'Zuschläge rechnen sich selbst — Feiertag schlägt Sonntag',
      'Urlaub, Krank und Bereitschaft mit fester Tagespauschale',
      'Kundenrechnung aus der Baustelle — Zeit und Material als Positionen',
      'CSV-Export für den Steuerberater, fertig für deutsches Excel',
      'Monat abschließen und sperren — nichts verschiebt sich rückwirkend',
      'Chef-PIN und tägliche Sicherung: Löhne sieht nur, wer sie sehen darf',
    ],
    custom: 'Zuschlagssätze, Lohnarten, Verrechnungssätze und der Rechnungskopf werden auf deinen Betrieb gestellt — gerechnet wird nach euren Regeln, nicht nach meiner Vorlage.',
  },

  'weitere-automatisierung': {
    eyebrow: 'Werkzeug 05',
    title: 'Gebaut auf deinen Ablauf',
    video: '',
    poster: '',
    desc: 'Angebote schreiben, Rechnungen stellen, Kundendaten pflegen, dasselbe zum dritten Mal von einem Programm ins nächste tippen — in jedem Betrieb frisst irgendetwas jede Woche Stunden. Sag mir, was es bei dir ist, und ich baue die Automatisierung passgenau dazu. Die vier Werkzeuge oben sind genauso entstanden: aus einer konkreten Arbeit, die jemandem den Feierabend gekostet hat. Wir schauen uns deinen Ablauf einmal in Ruhe an — danach weißt du, was geht, was es kostet und was es dir spart.',
    points: [
      'Angebote und Rechnungen, die sich aus euren Daten selbst schreiben',
      'Kundendaten an einer Stelle statt in drei Programmen',
      'Die Übergabe zwischen zwei Programmen läuft von allein',
      'Erst ein Blick auf euren Ablauf, dann ein festes Angebot',
    ],
    custom: 'Hier gibt es gar keine Standardfassung — was gebaut wird, gibt allein dein Ablauf vor.',
  },
};

const NDCart = (() => {
  const STORAGE_KEY = 'je-cart-v1';

  // --- State ---
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch (_) { cart = []; }
  // Keys aus einer früheren Fassung der Leistungen wegwerfen — sonst zählt
  // die Auswahl Punkte mit, zu denen es keinen Text mehr gibt.
  if (Array.isArray(cart)) cart = cart.filter((k) => !!PRICE_DATA[k]);
  else cart = [];

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
  const elMedia = document.getElementById('priceDialogMedia');
  const elPoints = document.getElementById('priceDialogPoints');
  const elCustom = document.getElementById('priceDialogCustom');
  const btnAdd = document.getElementById('priceDialogAdd');

  let lastFocused = null;
  let currentKey = null;

  function syncAddBtn() {
    if (!btnAdd || !currentKey) return;
    btnAdd.classList.toggle('is-selected', NDCart.has(currentKey));
  }

  function openDialog(key, triggerEl) {
    const data = PRICE_DATA[key];
    if (!data) return;
    currentKey = key;
    elEyebrow.textContent = data.eyebrow || 'Leistung';
    elTitle.textContent = data.title || '';
    elDesc.textContent = data.desc || '';

    // Video nur einhängen, wenn in PRICE_DATA eines hinterlegt ist. Beim
    // Schliessen wird es wieder entfernt, damit kein Ton weiterlaeuft.
    if (elMedia) {
      elMedia.innerHTML = '';
      if (data.video) {
        const v = document.createElement('video');
        v.src = data.video;
        v.controls = true;
        v.playsInline = true;
        v.preload = 'metadata';
        if (data.poster) v.poster = data.poster;
        elMedia.appendChild(v);
        elMedia.hidden = false;
      } else {
        elMedia.hidden = true;
      }
    }

    // Stichpunkte
    if (elPoints) {
      elPoints.innerHTML = '';
      const pts = Array.isArray(data.points) ? data.points : [];
      pts.forEach((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        elPoints.appendChild(li);
      });
      elPoints.hidden = pts.length === 0;
    }

    if (elCustom) {
      elCustom.textContent = data.custom || '';
      elCustom.hidden = !data.custom;
    }

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
    if (elMedia) elMedia.innerHTML = '';   // stoppt ein laufendes Video

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
    NDCart.toggle(currentKey);
    syncAddBtn();
  });

  // Re-sync dialog button when cart changes externally
  NDCart.subscribe(() => syncAddBtn());
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
        NDCart.remove(key);
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

  selClear?.addEventListener('click', () => NDCart.clear());

  NDCart.subscribe(update);
})();

// === Lucide Icons initialisieren ===
function initLucideIcons() {
  if (window.lucide) window.lucide.createIcons();
}
initLucideIcons();

// === Reload startet immer oben — ein Anker-Link springt zum Abschnitt ===
// Ohne Hash fängt die Seite oben an, und beim Neuladen ebenfalls: sonst landet
// man nach einem Reload mitten im Dokument, weil vom letzten Klick noch ein
// Hash in der Adresse steht.
// MIT Hash und frisch aufgerufen — etwa neufeld.digital/#termin, der Knopf
// „Termin vereinbaren" im Erklär-Video für die Elektrobetriebe — soll der
// Besucher dagegen genau dort ankommen. Dann bleibt der Hash stehen und der
// Block „Direktlink auf einen Abschnitt" weiter unten springt hin.
(() => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const nav = performance.getEntriesByType?.('navigation')?.[0];
  const istReload = nav ? nav.type === 'reload' : false;
  let ankerZiel = false;
  if (location.hash && location.hash.length > 1 && !istReload) {
    try { ankerZiel = !!document.querySelector(location.hash); } catch { ankerZiel = false; }
  }
  if (ankerZiel) return;                    // nicht nach oben zwingen
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
    duration: 460,
    easing: 'ease-out-cubic',
    once: true,
    offset: 60,
    disable: 'phone'
  });
}

// === Hero-Eintritt ===
// Früher lief hier eine GSAP-Timeline, die aber auf alte Klassennamen zielte
// (.hero-text, .hero-cta, .hero-visual existieren nicht mehr) und nur die H1
// mit 0,8 s Verzögerung einblendete. Der Hero erscheint jetzt direkt mit dem
// Page-Fade-In (unten) — schneller, ohne doppelte Animation, ohne GSAP.

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
          setTimeout(() => w.classList.add('is-revealed'), i * 30);
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('.section-head h2, .about-text h2, .termin-info h2').forEach(h => {
    observer.observe(h);
  });
})();

// 4. Parallax auf einem Hero-Bild — entfernt (2026-08-31).
//    Der Hero ist seit dem Neuaufbau reine Typografie, ein .hero-visual
//    existiert nicht mehr.

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

    // Die Bewertung geht per Mail an Jonas und erscheint öffentlich erst nach
    // manueller Freigabe (Eintrag in reviews.json). Bewusst KEIN localStorage,
    // damit keine „Geister"-Bewertungen nur im eigenen Browser auftauchen.
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, org, stars, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Senden fehlgeschlagen');
      if (statusEl) { statusEl.textContent = 'Danke! Deine Bewertung ist angekommen.'; statusEl.classList.add('is-ok'); }
      form.reset();
      setStars(5);
      setTimeout(closeDialog, 1500);
    } catch (err) {
      console.warn('Review-API nicht erreichbar:', err);
      if (statusEl) {
        statusEl.textContent = 'Senden hat nicht geklappt — bitte später nochmal versuchen oder direkt an kontakt@neufeld.digital.';
        statusEl.classList.add('is-error');
      }
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
  const items = document.querySelectorAll('.trust-strip strong');
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

// 7. Hero-Scroll-Parallax — entfernt (2026-08-31).
//    Der Hero enthaelt jetzt das Vertrauens-Band; ein wegfadender
//    Block haette die Zahlen mitgenommen.

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
  document.querySelectorAll('.tool-card, .process-card').forEach((card) => {
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
// 12b. Magnetic-CTA — ENTFERNT (2026-07-02).
//      Der zum Cursor „springende" Button überschrieb per Inline-Transform
//      den sauberen CSS-Hover-Lift (:hover translateY) und fühlte sich buggy
//      an (Button wich dem Klick aus). Der Button bleibt jetzt fix und
//      reagiert nur mit dem knackigen Hover-/Active-State aus dem CSS.
// ============================================================

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
    '.tool-card',
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
        if (idx > 0 && (selector === '.tool-card' || selector === '.empfehlung-card' || selector === '.process-card')) {
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
      // Nicht beim Drawer geöffnet, nicht ganz oben — und nur auf Desktop.
      // Auf dem Handy bleibt die Leiste durchgehend oben sichtbar.
      const drawerOpen = document.body.classList.contains('nav-open');
      if (!drawerOpen && y > 120 && window.innerWidth > 640) {
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
window.NDReviews = (() => {
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

  const hostFromUrl = (url) => String(url).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');

  const websiteLink = (website) => {
    if (!website) return '';
    const href = /^https?:\/\//.test(website) ? website : `https://${website}`;
    return `
          <a class="review-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="Website ansehen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <span>${escapeHtml(hostFromUrl(website))}</span>
          </a>`;
  };

  // Personen-Block (Avatar + Name + Firma). Wird zweimal gerendert:
  // 'top'    → oben neben den Sternen (Name links, ohne Profilbild) — auf allen Geräten sichtbar
  // 'bottom' → unten neben dem Link — per CSS durchgängig ausgeblendet (Altlast)
  const personBlock = (r, variant) => `
          <div class="review-person review-person--${variant}">
            <div class="review-avatar" aria-hidden="true">${escapeHtml(initials(r.name))}</div>
            <div class="review-author">
              <span class="review-name">${escapeHtml(r.name)}</span>
              ${r.org ? `<span class="review-org">${escapeHtml(r.org)}</span>` : ''}
            </div>
          </div>`;

  const cardHTML = (r, freshId) => {
    const stars = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
    const fresh = freshId && r.id === freshId ? ' is-fresh' : '';
    return `
      <article class="review-card${fresh}" data-id="${escapeHtml(r.id)}">
        <header class="review-head">
          <div class="review-stars" aria-label="${r.stars} von 5 Sternen">${stars}</div>
          ${personBlock(r, 'top')}
        </header>
        <p class="review-text">„${escapeHtml(r.text)}"</p>
        <footer class="review-meta">
          ${personBlock(r, 'bottom')}
          ${websiteLink(r.website)}
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

  // ---- Handy: Bewertungen als Endlos-Band, laufen nach rechts ----
  const mqMobile = window.matchMedia('(max-width: 767px)');
  let carousel = null;

  const setupMobileMarquee = (count) => {
    wrap.classList.add('is-mobile-marquee');

    // Erst eine Runde messen: die Kartenreihe muss breiter als der
    // Bildschirm sein, sonst klafft im Loop eine Lücke.
    const once = track.innerHTML;
    const singleWidth = track.scrollWidth;
    const copies = singleWidth > 0
      ? Math.max(1, Math.ceil((window.innerWidth * 1.3) / singleWidth))
      : 1;
    const block = once.repeat(copies);
    track.innerHTML = block + block; // zweite Hälfte = nahtloser Rücksprung

    // Tempo an die Kartenzahl koppeln: ca. 10s pro Card
    const cards = count * copies;
    wrap.style.setProperty('--marquee-duration', `${Math.max(18, cards * 10)}s`);

    // Finger drauf = Band hält an, damit man in Ruhe lesen kann
    const pause = () => wrap.classList.add('is-paused');
    const resume = () => wrap.classList.remove('is-paused');
    wrap.addEventListener('touchstart', pause, { passive: true });
    wrap.addEventListener('touchend', resume, { passive: true });
    wrap.addEventListener('touchcancel', resume, { passive: true });

    return {
      destroy() {
        wrap.removeEventListener('touchstart', pause);
        wrap.removeEventListener('touchend', resume);
        wrap.removeEventListener('touchcancel', resume);
        wrap.classList.remove('is-mobile-marquee', 'is-paused');
      },
    };
  };

  const render = (reviews, freshId) => {
    if (carousel) { carousel.destroy(); carousel = null; }
    if (!reviews.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    wrap.classList.remove('is-marquee', 'is-mobile-marquee', 'is-paused');
    wrap.style.removeProperty('--marquee-duration');
    track.innerHTML = reviews.map((r) => cardHTML(r, freshId)).join('');
    if (mqMobile.matches && reviews.length > 1) {
      carousel = setupMobileMarquee(reviews.length);
    } else {
      applyMarquee(reviews.length);
    }
  };

  let _cache = [];

  const refresh = async (freshId) => {
    // Nur echte, freigegebene Bewertungen vom Server (reviews.json) anzeigen.
    // Bewusst KEIN localStorage-Merge mehr — sonst tauchen eigene Test-Eingaben
    // als „Geister"-Bewertungen nur im eigenen Browser auf.
    try {
      const res = await fetch('/api/reviews', { cache: 'no-store' });
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      _cache = Array.isArray(data.reviews) ? data.reviews : [];
    } catch {
      _cache = [];
    }
    render(_cache, freshId);
  };

  // Initial laden
  refresh();

  // Wechsel Handy <-> Desktop: Karussell auf- bzw. abbauen
  const onBreakpoint = () => { if (_cache.length) render(_cache); };
  if (mqMobile.addEventListener) mqMobile.addEventListener('change', onBreakpoint);
  else mqMobile.addListener(onBreakpoint);

  return { refresh };
})();

// ============================================================
// 15. Leistungen — Aufklapp-Liste
//     Die fuenf Werkzeuge stehen untereinander; ein Klick klappt die
//     Erklaerung auf. Immer nur eine offen, sonst verliert man die Liste
//     aus dem Blick. "Zur Auswahl" haengt am bestehenden Warenkorb.
// ============================================================
(() => {
  const list = document.querySelector('.tool-list');
  if (!list) return;

  const items = Array.from(list.querySelectorAll('.tool-item'));
  const timers = new WeakMap();

  // Nach der Animation die feste Hoehe wieder loesen. transitionend allein
  // reicht nicht — wird die Animation unterbrochen, bliebe das Panel haengen.
  function afterSlide(panel, fn) {
    window.clearTimeout(timers.get(panel));
    const done = (e) => {
      if (e && e.propertyName !== 'height') return;
      panel.removeEventListener('transitionend', done);
      window.clearTimeout(timers.get(panel));
      fn();
    };
    panel.addEventListener('transitionend', done);
    timers.set(panel, window.setTimeout(done, 600));
  }

  function closeItem(item) {
    const head = item.querySelector('.tool-toggle');
    const panel = item.querySelector('.tool-panel');
    if (!head || !panel || head.getAttribute('aria-expanded') !== 'true') return;
    head.setAttribute('aria-expanded', 'false');
    item.classList.remove('is-open');
    if (_reduceMotion) { panel.hidden = true; panel.style.height = ''; return; }
    panel.style.height = panel.scrollHeight + 'px';
    void panel.offsetHeight;                 // Layout erzwingen, sonst kein Uebergang
    panel.style.height = '0px';
    afterSlide(panel, () => {
      if (item.classList.contains('is-open')) return;   // zwischendurch neu geoeffnet
      panel.hidden = true;
      panel.style.height = '';
    });
  }

  function openItem(item) {
    const head = item.querySelector('.tool-toggle');
    const panel = item.querySelector('.tool-panel');
    if (!head || !panel) return;
    head.setAttribute('aria-expanded', 'true');
    item.classList.add('is-open');
    panel.hidden = false;
    if (_reduceMotion) { panel.style.height = ''; return; }
    panel.style.height = '0px';
    void panel.offsetHeight;
    panel.style.height = panel.scrollHeight + 'px';
    afterSlide(panel, () => {
      if (!item.classList.contains('is-open')) return;
      panel.style.height = 'auto';           // waechst mit, wenn sich der Umbruch aendert
    });
  }

  items.forEach((item) => {
    const head = item.querySelector('.tool-toggle');
    head?.addEventListener('click', () => {
      const wasOpen = head.getAttribute('aria-expanded') === 'true';
      items.forEach((other) => { if (other !== item) closeItem(other); });
      if (wasOpen) { closeItem(item); return; }
      openItem(item);
      // Beim Aufklappen rutscht die Zeile sonst leicht aus dem Bild
      const top = head.getBoundingClientRect().top;
      if (top < 80 || top > window.innerHeight * 0.5) {
        window.setTimeout(() => {
          head.scrollIntoView({ behavior: _reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }, 140);
      }
    });
  });

  // "Zur Auswahl" haengt am selben Warenkorb wie der Preis-Dialog
  list.querySelectorAll('[data-tool-add]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      NDCart.toggle(btn.dataset.toolAdd);
    });
  });

  NDCart.subscribe((cartItems) => {
    items.forEach((item) => {
      const on = cartItems.includes(item.dataset.toolKey);
      item.classList.toggle('is-selected', on);
      const btn = item.querySelector('[data-tool-add]');
      if (!btn) return;
      btn.classList.toggle('is-selected', on);
      const t = btn.querySelector('.tool-select-text');
      if (t) t.textContent = on ? 'Ausgewählt' : 'Zur Auswahl';
    });
  });
})();


/* ND-INTERAKTION:START — Klick auf das Symbol der Ablauf-Karte klappt auf.
   Delegation am Dokument, damit es auch greift, wenn patch-neufeld.py die
   Karten neu baut. Das Symbol ist aria-hidden; zustaendig fuer Tastatur und
   Screenreader bleibt der Knopf "Mehr erfahren" daneben. */
document.addEventListener('click', (e) => {
  const icon = e.target.closest('.process-icon');
  if (!icon) return;
  const kopf = icon.closest('.process-card-head') || icon.parentElement;
  const btn = kopf && kopf.querySelector('.process-toggle');
  if (btn) btn.click();
});
/* ND-INTERAKTION:END */

/* ND-LEISTUNGEN:START */
/* Notnagel: laedt AOS nicht (Adblocker, Skriptfehler, mieses Netz), bleibt
   sonst alles unter dem Hero auf opacity 0 stehen. */
setTimeout(() => {
  if (!document.querySelector('[data-aos].aos-animate')) {
    document.documentElement.classList.add('no-js');
  }
}, 3000);
/* ND-LEISTUNGEN:END */
