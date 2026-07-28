import { Resend } from "resend";

type ContactRequestBody = {
  name: string;
  email: string;
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonError(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  let body: Partial<ContactRequestBody>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Cuerpo de la petición inválido.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || !email || !message) {
    return jsonError("Nombre, correo y mensaje son obligatorios.", 400);
  }
  if (!EMAIL_RE.test(email)) {
    return jsonError("El correo electrónico no tiene un formato válido.", 400);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const toEmail = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !fromEmail || !toEmail) {
    return jsonError("El servidor de correo no está configurado.", 500);
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    replyTo: email,
    subject: `Nuevo mensaje de contacto de ${name}`,
    text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${message}`,
  });

  if (error) {
    return jsonError(error.message || "No se pudo enviar el correo.", 500);
  }

  return Response.json({ ok: true });
}
