const { Resend } = require('resend');

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

  const { RESEND_API_KEY, FROM_EMAIL, TO_EMAIL } = process.env;
  if (!RESEND_API_KEY || !FROM_EMAIL || !TO_EMAIL) {
    console.error('[contact] fehlende Env-Vars: RESEND_API_KEY / FROM_EMAIL / TO_EMAIL');
    return res.status(500).json({ error: 'Mail-Versand ist nicht konfiguriert' });
  }

  const resend = new Resend(RESEND_API_KEY);

  const themaText = THEMA_LABEL[value.treatment] || value.treatment || '–';
  const fullName = `${value.firstname} ${value.lastname}`.trim();
  const fmtDateDe = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const hasTermin = Boolean(value.date);
  const terminDatum = hasTermin ? fmtDateDe(value.date) : '–';
  const terminUhrzeit = value.time ? `${value.time} Uhr` : '–';
  const receivedStr = new Date(value.receivedAt).toLocaleString('de-DE');

  const fromAddress = `${OWNER_NAME} <${FROM_EMAIL}>`;

  // ── Mail-Bausteine (HTML, e-mail-sicher: Inline-Styles + Tabellen) ──
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

  const sumRow = (label, val) => `
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:#8a8a85;width:96px;vertical-align:top;">${label}</td>
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
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sumRow('Name', esc(fullName))}${sumRow('E-Mail', `<a href="mailto:${esc(value.email)}" style="color:#E07856;text-decoration:none;">${esc(value.email)}</a>`)}${sumRow('Telefon', esc(value.phone || '–'))}${sumRow('Thema', esc(themaText))}${sumRow('Datum', esc(terminDatum))}${sumRow('Uhrzeit', esc(terminUhrzeit))}</table>
              <div style="margin-top:14px;padding-top:14px;border-top:1px solid #ececec;">
                <div style="font-size:13px;color:#8a8a85;margin-bottom:6px;">Nachricht</div>
                <div style="font-size:14px;color:#1a1a1f;line-height:1.6;">${nl2br(value.message || '(keine Nachricht)')}</div>
              </div>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;color:#a8a8a3;">Empfangen: ${esc(receivedStr)}</p>`;

  const confirmInner = `
          <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#444;">vielen Dank für deine Nachricht! Sie ist bei mir angekommen — ich melde mich innerhalb von 24&nbsp;Stunden persönlich bei dir zurück.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F5;border:1px solid #eee;border-radius:12px;margin:0 0 22px;">
            <tr><td style="padding:18px 20px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#E07856;font-weight:700;margin-bottom:10px;">Zusammenfassung</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sumRow('Thema', esc(themaText))}${value.phone ? sumRow('Telefon', esc(value.phone)) : ''}${hasTermin ? sumRow('Datum', esc(terminDatum)) + sumRow('Uhrzeit', esc(terminUhrzeit)) : ''}</table>
              <div style="margin-top:14px;padding-top:14px;border-top:1px solid #ececec;">
                <div style="font-size:13px;color:#8a8a85;margin-bottom:6px;">Deine Nachricht</div>
                <div style="font-size:14px;color:#1a1a1f;line-height:1.6;">${nl2br(value.message)}</div>
              </div>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:14px;color:#444;">Falls du in der Zwischenzeit etwas brauchst:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">${sumRow('E-Mail', `<a href="mailto:${esc(TO_EMAIL)}" style="color:#E07856;text-decoration:none;">${esc(TO_EMAIL)}</a>`)}${sumRow('Telefon', `<a href="tel:${OWNER_PHONE.replace(/\s/g, '')}" style="color:#1a1a1f;text-decoration:none;">${esc(OWNER_PHONE)}</a>`)}</table>
          <p style="margin:0;font-size:14px;line-height:1.65;color:#444;">Herzliche Grüße<br><strong style="color:#1a1a1f;">Jonas</strong><br><span style="color:#8a8a85;">Neufeld Digital &middot; Websites &amp; Tools für Firmen</span></p>`;

  const adminMail = {
    from: fromAddress,
    to: TO_EMAIL,
    reply_to: value.email,
    subject: `Neue Terminanfrage von ${fullName}`,
    html: layout(`Neue Anfrage von ${esc(fullName)}`, adminInner),
    text:
`Neue Anfrage über neufeld.digital

Name:         ${fullName}
E-Mail:       ${value.email}
Telefon:      ${value.phone || '–'}
Thema:        ${themaText}
Datum:        ${terminDatum}
Uhrzeit:      ${terminUhrzeit}

Nachricht:
${value.message || '(keine Nachricht)'}

Empfangen: ${receivedStr}`,
  };

  const confirmMail = {
    from: fromAddress,
    to: value.email,
    subject: 'Deine Anfrage ist angekommen — Neufeld Digital',
    html: layout(`Hallo ${esc(value.firstname)}, deine Anfrage ist da`, confirmInner),
    text:
`Hallo ${value.firstname},

vielen Dank für deine Nachricht! Sie ist bei mir angekommen — ich melde mich innerhalb von 24 Stunden persönlich bei dir zurück.

ZUSAMMENFASSUNG
  Thema:        ${themaText}${value.phone ? `\n  Telefon:      ${value.phone}` : ''}${hasTermin ? `\n  Datum:        ${terminDatum}\n  Uhrzeit:      ${terminUhrzeit}` : ''}

  Deine Nachricht:
  ${(value.message || '(keine Nachricht)').split('\n').join('\n  ')}

Falls du in der Zwischenzeit etwas brauchst:
  E-Mail:   ${TO_EMAIL}
  Telefon:  ${OWNER_PHONE}

Herzliche Grüße
Jonas
Neufeld Digital · Websites & Tools für Firmen`,
  };

  try {
    const [adminResult, confirmResult] = await Promise.all([
      resend.emails.send(adminMail),
      resend.emails.send(confirmMail),
    ]);

    if (adminResult.error || confirmResult.error) {
      console.error('[contact] Resend-Fehler:', adminResult.error || confirmResult.error);
      return res.status(500).json({ error: 'Mail konnte nicht gesendet werden' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] Resend-Fehler:', err);
    return res.status(500).json({ error: 'Mail konnte nicht gesendet werden' });
  }
};

function safeParse(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}
