const nodemailer = require("nodemailer");

const ALERT_EMAILS = [
  process.env.ADMIN_EMAIL,
  process.env.MOD_EMAIL_1,
  process.env.MOD_EMAIL_2,
  process.env.MOD_EMAIL_3
].filter(Boolean);

async function sendReportAlert(reportData) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_EMAIL,
    to: ALERT_EMAILS.join(","),
    subject: `[REPORT] ${reportData.reason}`,
    text: JSON.stringify(reportData, null, 2)
  });
}

module.exports = { sendReportAlert };
