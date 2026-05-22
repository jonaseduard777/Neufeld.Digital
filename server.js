// Lokaler Test-Server für Jonas Digital
// Start: node server.js  →  http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const PORT = 3000;
const ROOT = __dirname;

// ── .env laden (falls vorhanden) ──
// Format: KEY=value (eine Variable pro Zeile, # für Kommentare)
try {
  const envFile = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Anführungszeichen entfernen
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
} catch { /* keine .env vorhanden — okay */ }

// ── E-Mail-Konfiguration ──
// Setze beim Start: GMAIL_USER und GMAIL_APP_PASSWORD als Umgebungsvariablen
// Beispiel:
//   GMAIL_USER=kontakt@neufeld.digital GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx" node server.js
//
// Das App-Passwort erstellst du in deinem Google-Konto:
//   1. https://myaccount.google.com/security  → 2-Faktor aktivieren
//   2. https://myaccount.google.com/apppasswords → neues App-Passwort erstellen
const OWNER_EMAIL = 'kontakt@neufeld.digital';
const OWNER_PHONE = '+49 173 2961293';
const OWNER_NAME = 'Jonas Digital';

const mailer = (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  : null;

async function sendEmails(msg) {
  if (!mailer) {
    console.log('[E-Mail-Versand deaktiviert] keine GMAIL_USER/GMAIL_APP_PASSWORD gesetzt');
    return;
  }

  const themaText = {
    website: 'Website für meine Firma',
    tool: 'Tool / Automatisierung',
    beides: 'Beides',
    anderes: 'Etwas Anderes',
  }[msg.thema] || msg.thema || '–';

  // 1. Mail an Jonas (mit Reply-To = Absender)
  const adminMail = {
    from: `"Jonas Digital Webseite" <${process.env.GMAIL_USER}>`,
    to: OWNER_EMAIL,
    replyTo: msg.email,
    subject: `Neue Anfrage von ${msg.name}`,
    text:
`Neue Anfrage über die Webseite:

Name:      ${msg.name}
E-Mail:    ${msg.email}
Telefon:   ${msg.telefon || '–'}
Thema:     ${themaText}
Wunschdatum: ${msg.datum || '–'}

Nachricht:
${msg.nachricht || '(keine Nachricht)'}

Empfangen: ${new Date(msg.receivedAt).toLocaleString('de-DE')}`,
  };

  // 2. Bestätigungsmail an den Absender
  const confirmMail = {
    from: `"${OWNER_NAME}" <${process.env.GMAIL_USER}>`,
    to: msg.email,
    subject: 'Deine Anfrage ist angekommen — Jonas Digital',
    text:
`Hallo ${msg.name},

vielen Dank für deine Nachricht! Sie ist bei mir angekommen und ich melde mich innerhalb von 24 Stunden persönlich bei dir zurück.

Hier nochmal eine Zusammenfassung deiner Anfrage:

  Thema:        ${themaText}${msg.telefon ? `\n  Telefon:      ${msg.telefon}` : ''}${msg.datum ? `\n  Wunschdatum:  ${msg.datum}` : ''}

  Deine Nachricht:
  ${(msg.nachricht || '(keine Nachricht)').split('\n').join('\n  ')}

Falls du in der Zwischenzeit etwas brauchst, erreichst du mich auch direkt:

  E-Mail:   ${OWNER_EMAIL}
  Telefon:  ${OWNER_PHONE}

Bis bald & herzliche Grüße
Jonas
— Jonas Digital · Websites & Tools für Firmen · aus Dorsten`,
  };

  try {
    await Promise.all([
      mailer.sendMail(adminMail),
      mailer.sendMail(confirmMail),
    ]);
    console.log(`[E-Mail] Anfrage + Bestätigung an ${msg.email} gesendet`);
  } catch (err) {
    console.error('[E-Mail-Fehler]', err.message);
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { req.destroy(); reject(new Error('too large')); }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    ...headers,
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404</h1>');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

// Validator für eingehende Kontaktanfragen
// ── Bewertungen-Storage (reviews.json neben server.js) ──
const REVIEWS_PATH = path.join(ROOT, 'reviews.json');
function readReviews() {
  try {
    const raw = fs.readFileSync(REVIEWS_PATH, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function writeReviews(list) {
  fs.writeFileSync(REVIEWS_PATH, JSON.stringify(list, null, 2), 'utf8');
}
function validateReview(body) {
  const name = String(body.name || '').trim().slice(0, 100);
  const email = String(body.email || '').trim().slice(0, 200);
  const org = String(body.org || '').trim().slice(0, 100);
  const text = String(body.text || '').trim().slice(0, 1500);
  const stars = Math.max(1, Math.min(5, parseInt(body.stars, 10) || 0));
  if (!name || !email || !text) return { error: 'Name, E-Mail und Bewertung sind Pflicht' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Ungültige E-Mail-Adresse' };
  if (!stars) return { error: 'Bitte Sterne auswählen' };
  return { value: {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name, email, org, stars, text,
  }};
}

function validateMessage(body) {
  const name = String(body.name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 200);
  const telefon = String(body.telefon || '').trim().slice(0, 50);
  const thema = String(body.thema || '').trim().slice(0, 100);
  const datum = String(body.datum || '').trim();
  const nachricht = String(body.nachricht || '').trim().slice(0, 5000);
  if (!name || !email) return { error: 'Name und E-Mail sind Pflicht' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Ungültige E-Mail-Adresse' };
  if (datum && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { error: 'Ungültiges Datum' };
  return { value: {
    id: crypto.randomUUID(), receivedAt: new Date().toISOString(),
    name, email, telefon, thema, datum, nachricht,
  }};
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  // CORS-Preflight für file://-Aufrufe
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    });
    return res.end();
  }

  // Öffentliches Kontaktformular — schickt E-Mails
  if (method === 'POST' && url === '/api/contact') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const result = validateMessage(body);
      if (result.error) return send(res, 400, { error: result.error });
      console.log(`[neue Nachricht] ${result.value.name} <${result.value.email}>`);
      sendEmails(result.value).catch(() => { /* schon geloggt */ });
      return send(res, 200, { ok: true });
    } catch {
      return send(res, 400, { error: 'Ungültige Daten' });
    }
  }

  // ── Bewertungen ──
  // GET  /api/reviews  → Liste aller veröffentlichten Bewertungen
  // POST /api/reviews  → neue Bewertung speichern (sofort sichtbar)
  if (method === 'GET' && url === '/api/reviews') {
    try {
      const reviews = readReviews();
      // Neueste zuerst
      const list = reviews.slice().reverse().map(r => ({
        id: r.id,
        name: r.name,
        org: r.org || '',
        stars: r.stars,
        text: r.text,
        createdAt: r.createdAt,
      }));
      return send(res, 200, { reviews: list });
    } catch {
      return send(res, 500, { error: 'Konnte Bewertungen nicht laden' });
    }
  }
  if (method === 'POST' && url === '/api/reviews') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const result = validateReview(body);
      if (result.error) return send(res, 400, { error: result.error });
      const reviews = readReviews();
      reviews.push(result.value);
      writeReviews(reviews);
      console.log(`[neue Bewertung] ${result.value.name} · ${result.value.stars}★`);
      // Mail-Benachrichtigung an Owner (best effort)
      if (mailer) {
        mailer.sendMail({
          from: `"Jonas Digital Webseite" <${process.env.GMAIL_USER}>`,
          to: OWNER_EMAIL,
          replyTo: result.value.email,
          subject: `Neue Bewertung (${result.value.stars}★) von ${result.value.name}`,
          text:
`Neue Bewertung über die Webseite:

Name:    ${result.value.name}
E-Mail:  ${result.value.email}
Firma:   ${result.value.org || '—'}
Sterne:  ${'★'.repeat(result.value.stars)}${'☆'.repeat(5 - result.value.stars)}

Text:
${result.value.text}

Empfangen: ${new Date(result.value.createdAt).toLocaleString('de-DE')}`,
        }).catch(() => {});
      }
      return send(res, 200, { ok: true, review: {
        id: result.value.id,
        name: result.value.name,
        org: result.value.org,
        stars: result.value.stars,
        text: result.value.text,
        createdAt: result.value.createdAt,
      }});
    } catch {
      return send(res, 400, { error: 'Ungültige Daten' });
    }
  }

  if (method === 'GET') return serveStatic(req, res);
  res.writeHead(405); res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Jonas Digital — Test-Server');
  console.log('  ───────────────────────────');
  console.log(`  Webseite:    http://localhost:${PORT}/`);
  console.log(`  E-Mail:      ${mailer ? '✓ aktiv (Gmail SMTP)' : '✗ deaktiviert — siehe README in server.js'}`);
  console.log('');
});
