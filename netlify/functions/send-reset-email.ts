// send-reset-email.ts — Sends a 6-digit password reset code via Resend API
// Required env var: RESEND_API_KEY (set in Netlify dashboard)
// Without RESEND_API_KEY, logs the code to console (dev/test mode)

import type { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, name, code } = JSON.parse(event.body || '{}');
    if (!email || !code) {
      return { statusCode: 400, body: JSON.stringify({ error: 'email and code are required' }) };
    }

    const firstName = (name || 'Usuário').split(' ')[0];

    // ── Dev mode: log code to console ──────────────────────────────────────────
    if (!process.env.RESEND_API_KEY) {
      console.log(`[DEV] Password reset code for ${email}: ${code}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, dev: true, message: 'Code logged to console (RESEND_API_KEY not set)' }),
      };
    }

    // ── Production: send via Resend API ────────────────────────────────────────
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;margin:0;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 32px;text-align:center">
      <div style="font-size:48px;margin-bottom:8px">🤖</div>
      <h1 style="color:white;margin:0;font-size:24px;font-weight:900">Impacto IA</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px">Plataforma de Aprendizagem</p>
    </div>
    <div style="padding:40px 32px">
      <h2 style="color:#1e293b;margin:0 0 8px;font-size:20px;font-weight:800">Olá, ${firstName}! 👋</h2>
      <p style="color:#64748b;margin:0 0 32px;line-height:1.6">Recebemos uma solicitação para redefinir a senha da sua conta. Use o código abaixo:</p>
      <div style="background:#f1f5f9;border-radius:16px;padding:24px;text-align:center;margin:0 0 32px">
        <div style="font-size:48px;font-weight:900;letter-spacing:0.3em;color:#6366f1;font-family:'Courier New',monospace">${code}</div>
        <p style="color:#94a3b8;font-size:12px;margin:12px 0 0;font-weight:600">VÁLIDO POR 15 MINUTOS</p>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.6">Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha permanece a mesma.</p>
    </div>
    <div style="background:#f8fafc;padding:24px 32px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="color:#cbd5e1;font-size:12px;margin:0">© ${new Date().getFullYear()} Impacto IA · Plataforma Educacional</p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@impactoia.com.br',
        to: [email],
        subject: `${code} — Seu código de redefinição de senha | Impacto IA`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[send-reset-email] Resend API error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send email', detail: err }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err: any) {
    console.error('[send-reset-email] Error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

export { handler };
