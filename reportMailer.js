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


document.addEventListener("DOMContentLoaded",()=>{
 const u=localStorage.getItem("username")||"guest";
 const r=localStorage.getItem("role")||"user";
 const admin=(u==="devshah"||r==="admin");

 document.querySelectorAll("[data-feature='admin'],#adminBtn,.admin-btn,.admin-nav,.admin-panel").forEach(el=>{
   if(!admin){
      el.remove();
   }
 });

});
