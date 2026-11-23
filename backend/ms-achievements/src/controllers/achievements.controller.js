const service = require("../services/achievements.service");

const getCatalog = async (_req, res, next) => {
  try {
    return res.json({ data: await service.getCatalog() });
  } catch (error) {
    return next(error);
  }
};

const getMine = async (req, res, next) => {
  try {
    return res.json({ data: await service.getUserAchievements(req.user.authId) });
  } catch (error) {
    return next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    return res.json({ data: await service.getUserAchievements(req.params.authId) });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getCatalog, getMine, getUser };
