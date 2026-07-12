import { NextRequest, NextResponse } from "next/server";

const TO_EMAIL = "lme797740@gmail.com";

// Escape user-supplied text before it lands in the HTML email body, so a
// submitter can't inject markup (phishing links, spoofed content) into the
// message the site owner receives.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const { name, email, message } = await req.json();

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
  }

  const safeName = escapeHtml(String(name).slice(0, 200));
  const safeEmail = escapeHtml(String(email).slice(0, 200));
  const safeMessage = escapeHtml(String(message).slice(0, 5000));

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Отзывы Sharmaster <onboarding@resend.dev>",
      to: [TO_EMAIL],
      reply_to: safeEmail,
      subject: `Отзыв от ${safeName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px">
          <h2 style="color:#0ea5e9">Новый отзыв с сайта Sharmaster.kz</h2>
          <p><strong>Имя:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
          <p style="white-space:pre-wrap">${safeMessage}</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
    return NextResponse.json({ error: "Не удалось отправить" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
