const repository = require("../repositories/achievements.repository");
const { publishAchievementUnlocked } = require("../utils/notification-events.util");

const normalizeAuthId = (value) => {
  const authId = String(value || "").trim();
  if (!authId || authId.length > 255) {
    throw Object.assign(new Error("authId invalido"), { status: 400 });
  }
  return authId;
};

const getCatalog = () => repository.getDefinitions();

const notifyUnlockedAchievements = async (unlocked = []) => {
  for (const achievement of unlocked) {
    await publishAchievementUnlocked({
      recipientAuthId: achievement.authId,
      achievement
    });
  }
};

const evaluateTenureAndNotify = async () => {
  const unlocked = await repository.evaluateTenureAchievements();
  await notifyUnlockedAchievements(unlocked);
};

const getUserAchievements = async (authId) => {
  const normalizedAuthId = normalizeAuthId(authId);
  await evaluateTenureAndNotify();
  return repository.getUserSummary(normalizedAuthId);
};

const startTenureEvaluation = () => {
  const interval = Math.max(Number(process.env.ACHIEVEMENTS_TENURE_CHECK_INTERVAL_MS || 3600000), 60000);
  const evaluate = () => evaluateTenureAndNotify()
    .catch((error) => console.error("[ms-achievements] Error evaluando antiguedad:", error.message));

  evaluate();
  return setInterval(evaluate, interval);
};

module.exports = { getCatalog, getUserAchievements, startTenureEvaluation };
