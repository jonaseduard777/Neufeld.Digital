// Lokaler Test-Server für Neufeld Digital
// Start: node server.js  →  http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch { /* optional — Mailer nur fürs Bewertungs-Benachrichtigung-Fallback, Termin-Mails laufen über Port 3200 */ }

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
const OWNER_NAME = 'Neufeld Digital';

const mailer = (nodemailer && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
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

  const wunsch = msg.datum || '–';
  const receivedStr = new Date(msg.receivedAt).toLocaleString('de-DE');

  // ── Mail-Bausteine (HTML, e-mail-sicher: Inline-Styles + Tabellen) ──
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

  const sumRow = (label, val) => `
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:#8a8a85;width:120px;vertical-align:top;">${label}</td>
                  <td style="padding:5px 0;font-size:14px;color:#1a1a1f;vertical-align:top;">${val}</td>
                </tr>`;

  const layout = (heading, inner) => `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF9F5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F5;padding:32px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border:1px solid #ececec;border-radius:16px;">
        <tr><td style="padding:28px 32px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:34px;height:34px;background:#1a1a1f;border:2px solid #E07856;border-radius:9px;color:#F4C7B1;font-weight:700;font-size:13px;text-align:center;line-height:34px;">ND</td>
            <td style="padding-left:10px;font-weight:600;font-size:15px;color:#1a1a1f;letter-spacing:-0.2px;">Neufeld Digital</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:26px 32px;border-top:1px solid #f0f0f0;">
          <h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#1a1a1f;letter-spacing:-0.4px;">${heading}</h1>
          ${inner}
        </td></tr>
        <tr><td style="padding:18px 32px 26px;border-top:1px solid #f0f0f0;font-size:12px;color:#a8a8a3;">
          <a href="https://www.neufeld.digital" style="color:#E07856;text-decoration:none;font-weight:600;">neufeld.digital</a> &middot; Websites &amp; Tools für Firmen
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const adminInner = `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F5;border:1px solid #eee;border-radius:12px;margin:0 0 18px;">
            <tr><td style="padding:18px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sumRow('Name', esc(msg.name))}${sumRow('E-Mail', `<a href="mailto:${esc(msg.email)}" style="color:#E07856;text-decoration:none;">${esc(msg.email)}</a>`)}${sumRow('Telefon', esc(msg.telefon || '–'))}${sumRow('Thema', esc(themaText))}${sumRow('Wunschdatum', esc(wunsch))}</table>
              <div style="margin-top:14px;padding-top:14px;border-top:1px solid #ececec;">
                <div style="font-size:13px;color:#8a8a85;margin-bottom:6px;">Nachricht</div>
                <div style="font-size:14px;color:#1a1a1f;line-height:1.6;">${nl2br(msg.nachricht || '(keine Nachricht)')}</div>
              </div>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;color:#a8a8a3;">Empfangen: ${esc(receivedStr)}</p>`;

  const confirmInner = `
          <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#444;">vielen Dank für deine Nachricht! Sie ist bei mir angekommen — ich melde mich innerhalb von 24&nbsp;Stunden persönlich bei dir zurück.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F5;border:1px solid #eee;border-radius:12px;margin:0 0 22px;">
            <tr><td style="padding:18px 20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#E07856;font-weight:700;margin-bottom:10px;">Zusammenfassung</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sumRow('Thema', esc(themaText))}${msg.telefon ? sumRow('Telefon', esc(msg.telefon)) : ''}${msg.datum ? sumRow('Wunschdatum', esc(msg.datum)) : ''}</table>
              <div style="margin-top:14px;padding-top:14px;border-top:1px solid #ececec;">
                <div style="font-size:13px;color:#8a8a85;margin-bottom:6px;">Deine Nachricht</div>
                <div style="font-size:14px;color:#1a1a1f;line-height:1.6;">${nl2br(msg.nachricht || '(keine Nachricht)')}</div>
              </div>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:14px;color:#444;">Falls du in der Zwischenzeit etwas brauchst:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">${sumRow('E-Mail', `<a href="mailto:${esc(OWNER_EMAIL)}" style="color:#E07856;text-decoration:none;">${esc(OWNER_EMAIL)}</a>`)}${sumRow('Telefon', `<a href="tel:${OWNER_PHONE.replace(/\s/g, '')}" style="color:#1a1a1f;text-decoration:none;">${esc(OWNER_PHONE)}</a>`)}</table>
          <p style="margin:0;font-size:14px;line-height:1.65;color:#444;">Herzliche Grüße<br><strong style="color:#1a1a1f;">Jonas</strong><br><span style="color:#8a8a85;">Neufeld Digital &middot; Websites &amp; Tools für Firmen</span></p>`;

  // 1. Mail an Jonas (mit Reply-To = Absender)
  const adminMail = {
    from: `"Neufeld Digital Webseite" <${process.env.GMAIL_USER}>`,
    to: OWNER_EMAIL,
    replyTo: msg.email,
    subject: `Neue Anfrage von ${msg.name}`,
    html: layout(`Neue Anfrage von ${esc(msg.name)}`, adminInner),
    text:
`Neue Anfrage über die Webseite

Name:        ${msg.name}
E-Mail:      ${msg.email}
Telefon:     ${msg.telefon || '–'}
Thema:       ${themaText}
Wunschdatum: ${wunsch}

Nachricht:
${msg.nachricht || '(keine Nachricht)'}

Empfangen: ${receivedStr}`,
  };

  // 2. Bestätigungsmail an den Absender
  const confirmMail = {
    from: `"${OWNER_NAME}" <${process.env.GMAIL_USER}>`,
    to: msg.email,
    subject: 'Deine Anfrage ist angekommen — Neufeld Digital',
    html: layout(`Hallo ${esc(msg.name)}, deine Anfrage ist da`, confirmInner),
    text:
`Hallo ${msg.name},

vielen Dank für deine Nachricht! Sie ist bei mir angekommen — ich melde mich innerhalb von 24 Stunden persönlich bei dir zurück.

ZUSAMMENFASSUNG
  Thema:        ${themaText}${msg.telefon ? `\n  Telefon:      ${msg.telefon}` : ''}${msg.datum ? `\n  Wunschdatum:  ${msg.datum}` : ''}

  Deine Nachricht:
  ${(msg.nachricht || '(keine Nachricht)').split('\n').join('\n  ')}

Falls du in der Zwischenzeit etwas brauchst:
  E-Mail:   ${OWNER_EMAIL}
  Telefon:  ${OWNER_PHONE}

Herzliche Grüße
Jonas
Neufeld Digital · Websites & Tools für Firmen`,
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

  // Öffentliches Kontaktformular — leitet die Buchung an die Termin-Inbox
  // (Port 3200) weiter; die kümmert sich um Speichern und Mail-Versand via Resend.
  if (method === 'POST' && url === '/api/contact') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      if (body._honey) return send(res, 200, { ok: true });

      const inboxRes = await fetch('http://localhost:3200/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, source: body.source || 'jonas-digital' }),
      });
      const inboxJson = await inboxRes.json().catch(() => ({}));
      if (!inboxRes.ok) {
        console.error('[contact→inbox]', inboxRes.status, inboxJson);
        return send(res, inboxRes.status, { error: inboxJson.error || 'Termin-Inbox lehnt die Anfrage ab' });
      }
      console.log(`[neue Buchung → Inbox] ${body.firstname || ''} ${body.lastname || ''} <${body.email || ''}>`);
      return send(res, 200, { ok: true });
    } catch (err) {
      console.error('[contact] Fehler:', err.message || err);
      return send(res, 502, { error: 'Termin-Inbox nicht erreichbar' });
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
          from: `"Neufeld Digital Webseite" <${process.env.GMAIL_USER}>`,
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
  console.log('  Neufeld Digital — Test-Server');
  console.log('  ───────────────────────────');
  console.log(`  Webseite:    http://localhost:${PORT}/`);
  console.log(`  E-Mail:      ${mailer ? '✓ aktiv (Gmail SMTP)' : '✗ deaktiviert — siehe README in server.js'}`);
  console.log('');
});
