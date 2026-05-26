const express = require("express");
const geoip = require("geoip-lite");
const { sendReportAlert } = require("./reportMailer");

const router = express.Router();

router.post("/report", async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const geo = geoip.lookup(ip);

    const reportData = {
      reportedBy: req.body.reportedBy,
      reportedUser: req.body.reportedUser,
      username: req.body.username,
      displayName: req.body.displayName,
      email: req.body.email,
      phone: req.body.phone,
      ip,
      location: geo,
      deviceInfo: req.headers["user-agent"],
      reason: req.body.reason,
      contentPreview: req.body.contentPreview,
      timestamp: new Date().toISOString()
    };

    await sendReportAlert(reportData);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Report failed" });
  }
});

module.exports = router;
