const nodemailer = require('nodemailer');

const OWNER_NAME = 'Neufeld Digital';
const OWNER_PHONE = '+49 173 2961293';

const THEMA_LABEL = {
  Website: 'Website für meine Firma',
  Tool: 'Tool / Automatisierung',
  Beides: 'Beides',
  Erstgespräch: 'Erstgespräch / Beratung',
  Anderes: 'Etwas Anderes',
};

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

function validate(body) {
  const firstname = clean(body.firstname, 100);
  const lastname = clean(body.lastname, 100);
  const email = clean(body.email, 200);
  const phone = clean(body.phone, 50);
  const treatment = clean(body.treatment, 100);
  const date = clean(body.date, 20);
  const time = clean(body.time, 20);
  const message = clean(body.message, 5000);

  if (!firstname || !lastname) return { error: 'Vor- und Nachname sind Pflicht' };
  if (!email) return { error: 'E-Mail ist Pflicht' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Ungültige E-Mail-Adresse' };
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Ungültiges Datum' };

  return {
    value: {
      firstname, lastname, email, phone, treatment, date, time, message,
      receivedAt: new Date().toISOString(),
    },
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});

  if (body._honey) return res.status(200).json({ ok: true });

  const { value, error } = validate(body);
  if (error) return res.status(400).json({ error });

  const { GMAIL_USER, GMAIL_APP_PASSWORD, TO_EMAIL } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !TO_EMAIL) {
    console.error('[contact] fehlende Env-Vars: GMAIL_USER / GMAIL_APP_PASSWORD / TO_EMAIL');
    return res.status(500).json({ error: 'Mail-Versand ist nicht konfiguriert' });
  }

  const mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  const themaText = THEMA_LABEL[value.treatment] || value.treatment || '–';
  const fullName = `${value.firstname} ${value.lastname}`.trim();
  const wunsch = [value.date, value.time].filter(Boolean).join(' · ') || '–';

  const adminMail = {
    from: `"Neufeld Digital Webseite" <${GMAIL_USER}>`,
    to: TO_EMAIL,
    replyTo: value.email,
    subject: `Neue Terminanfrage von ${fullName}`,
    text:
`Neue Anfrage über neufeld.digital:

Name:        ${fullName}
E-Mail:      ${value.email}
Telefon:     ${value.phone || '–'}
Thema:       ${themaText}
Wunschtermin: ${wunsch}

Nachricht:
${value.message || '(keine Nachricht)'}

Empfangen: ${new Date(value.receivedAt).toLocaleString('de-DE')}`,
  };

  const confirmMail = {
    from: `"${OWNER_NAME}" <${GMAIL_USER}>`,
    to: value.email,
    subject: 'Deine Anfrage ist angekommen — Neufeld Digital',
    text:
`Hallo ${value.firstname},

vielen Dank für deine Nachricht! Sie ist bei mir angekommen und ich melde mich innerhalb von 24 Stunden persönlich bei dir zurück.

Zusammenfassung deiner Anfrage:

  Thema:        ${themaText}${value.phone ? `\n  Telefon:      ${value.phone}` : ''}${wunsch !== '–' ? `\n  Wunschtermin: ${wunsch}` : ''}

  Deine Nachricht:
  ${(value.message || '(keine Nachricht)').split('\n').join('\n  ')}

Falls du in der Zwischenzeit etwas brauchst:

  E-Mail:   ${TO_EMAIL}
  Telefon:  ${OWNER_PHONE}

Herzliche Grüße
Jonas
— Neufeld Digital · Websites & Tools für Firmen · aus Dorsten`,
  };

  try {
    await Promise.all([
      mailer.sendMail(adminMail),
      mailer.sendMail(confirmMail),
    ]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] Mail-Fehler:', err.message);
    return res.status(500).json({ error: 'Mail konnte nicht gesendet werden' });
  }
};

function safeParse(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}
