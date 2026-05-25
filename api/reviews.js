const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Resend } = require('resend');

const OWNER_NAME = 'Neufeld Digital';
const REVIEWS_PATH = path.join(process.cwd(), 'reviews.json');

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

function safeParse(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function readReviews() {
  try {
    const raw = fs.readFileSync(REVIEWS_PATH, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function publicReview(r) {
  return {
    id: r.id,
    name: r.name,
    org: r.org || '',
    stars: r.stars,
    text: r.text,
    createdAt: r.createdAt,
  };
}

function validate(body) {
  const name = clean(body.name, 100);
  const email = clean(body.email, 200);
  const org = clean(body.org, 100);
  const text = clean(body.text, 2000);
  const stars = Math.min(5, Math.max(1, Number(body.stars) || 5));

  if (!name || !email || !text) return { error: 'Name, E-Mail und Bewertung sind Pflicht' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Ungültige E-Mail-Adresse' };

  return {
    value: {
      id: crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      name, email, org, stars, text,
    },
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const reviews = readReviews();
    const list = reviews.slice().reverse().map(publicReview);
    return res.status(200).json({ reviews: list });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const { value, error } = validate(body);
  if (error) return res.status(400).json({ error });

  const { RESEND_API_KEY, FROM_EMAIL, TO_EMAIL } = process.env;
  if (RESEND_API_KEY && FROM_EMAIL && TO_EMAIL) {
    try {
      const resend = new Resend(RESEND_API_KEY);
      await resend.emails.send({
        from: `${OWNER_NAME} <${FROM_EMAIL}>`,
        to: TO_EMAIL,
        reply_to: value.email,
        subject: `Neue Bewertung (${value.stars}★) von ${value.name}`,
        text:
`Neue Bewertung über neufeld.digital:

Name:    ${value.name}
E-Mail:  ${value.email}
Firma:   ${value.org || '–'}
Sterne:  ${'★'.repeat(value.stars)}${'☆'.repeat(5 - value.stars)} (${value.stars}/5)

Text:
${value.text}

Damit sie öffentlich erscheint, in reviews.json eintragen und deployen:

  {
    "id": "${value.id}",
    "createdAt": "${value.createdAt}",
    "name": "${value.name.replace(/"/g, '\\"')}",
    "email": "${value.email}",
    "org": "${value.org.replace(/"/g, '\\"')}",
    "stars": ${value.stars},
    "text": "${value.text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
  }`,
      });
    } catch (err) {
      console.error('[reviews] Resend-Fehler:', err);
    }
  } else {
    console.warn('[reviews] Env-Vars fehlen — Mail wurde nicht versendet');
  }

  return res.status(200).json({ ok: true, review: publicReview(value) });
};
