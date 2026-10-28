const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error("Faltan credenciales SMTP");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD.replace(/\s/g, "")
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000
    });
  }

  return transporter;
}

async function sendVerificationCode(email, code) {
  await getTransporter().sendMail({
    from: { name: "GameTracker", address: process.env.SMTP_USER },
    to: email,
    subject: "Verifica tu correo en GameTracker",
    text: `Tu código de verificación de GameTracker es: ${code}\n\nExpira en 10 minutos. Verifica tu correo para publicar comentarios. Si no solicitaste este código, ignora este mensaje.`,
    html: `<h1>GameTracker</h1><p>Verifica tu correo para publicar comentarios.</p><p>Tu código es:</p><p style="font-size:32px;letter-spacing:6px"><strong>${code}</strong></p><p>Expira en 10 minutos. Si no solicitaste este código, ignora este mensaje.</p>`
  });
}

module.exports = { sendVerificationCode };
