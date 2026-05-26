
// ADMIN FEATURE LOGS/BACKUPS

const featureLogs = {};
const featureBackups = {};

function addFeatureLog(feature, action, user) {
  if (!featureLogs[feature]) {
    featureLogs[feature] = [];
  }

  featureLogs[feature].push({
    action,
    user,
    time: new Date().toISOString(),
  });
}

app.get("/api/admin/logs/:feature", async (req, res) => {
  const feature = req.params.feature;

  return res.json({
    success: true,
    logs: featureLogs[feature] || []
  });
});

app.post("/api/admin/backup/:feature", async (req, res) => {
  const feature = req.params.feature;

  const data = await getFeatureData(feature);

  featureBackups[feature] = {
    createdAt: Date.now(),
    data
  };

  addFeatureLog(feature, "backup_created", req.user?.username);

  return res.json({
    success: true
  });
});

app.post("/api/admin/wipe/:feature", async (req, res) => {
  const feature = req.params.feature;

  if (!featureBackups[feature]) {
    return res.status(400).json({
      error: "Backup required before wipe"
    });
  }

  await wipeFeature(feature);

  addFeatureLog(feature, "feature_wiped", req.user?.username);

  return res.json({
    success: true
  });
});
