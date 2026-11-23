const service = require('../services/auth.service');
const emailVerification = require('../services/email-verification.service');

const userEvents = require('../utils/user-events.util');

const imageData = (file) => file ? {
  data: file.buffer,
  mimeType: file.mimetype
} : null;

const register = async (req, res) => res.status(201).json(await service.registerUser({
  ...(req.body || {}),
  profileImageData: imageData(req.file)
}));

const login = async (req, res) => res.json(await service.login(req.body));

const forgotPassword = async (req, res) => res.json(
  await service.forgotPassword(req.body?.email)
);

const resetPassword = async (req, res) => res.json(
  await service.resetPassword(req.body)
);

const changePassword = async (req, res) => res.json(
  await service.changePassword(req.user.sub, req.body)
);

const updateUsername = async (req, res) => res.json({
  user: await service.updateUsername(req.user.sub, req.body?.username)
});

const me = async (req, res) => res.json({ user: await service.getCurrentUser(req.user.sub) });


const resendVerification = async (req, res) => {
  const user = await service.getCurrentUser(req.user.sub);
  res.json(await emailVerification.sendCode(user));
};

const verifyEmail = async (req, res) => {
  const user = await service.getCurrentUser(req.user.sub);
  const wasVerified = user.emailVerified;
  const result = await emailVerification.verifyCode(user, req.body);

  if (!wasVerified && result.emailVerified) {
    const verifiedUser = await service.getCurrentUser(req.user.sub);
    userEvents.publishEmailVerified(verifiedUser);
  }

  res.json(result);
};

const updateProfile = async (req, res) => res.json({
  user: await service.updateProfile(req.user.sub, {
    name: req.body?.name,
    username: req.body?.username,
    image: imageData(req.file)
  })
});

const removeProfileImage = async (req, res) => {
  res.json({ data: await service.removeProfileImage(req.user.sub) });
};

const getProfileImage = async (req, res) => {
  const image = await service.getProfileImage(req.params.authId);

  res.set({
    'Content-Type': image.mimeType,
    'Content-Length': String(image.data.length),
    'Cache-Control': 'public, max-age=3600'
  });

  return res.send(image.data);
};

const unbanUser = async (req, res) => res.json({
  data: await service.unbanUser(req.params.authId, req.user.sub)
});

const getAdminStats = async (req, res) => res.json({
  data: await service.getAdminStats(req.get('authorization')?.split(' ')[1])
});

const searchUsers = async (req, res) => res.json({
  data: await service.searchUsers(req.query.q, { limit: req.query.limit })
});

const searchAdminUsers = async (req, res) => res.json({
  data: await service.searchUsers(req.query.q, {
    admin: true,
    limit: req.query.limit
  })
});

const getPublicProfileByUsername = async (req, res) => res.json({
  data: await service.getPublicProfileByUsername(
    req.params.username,
    req.get('authorization')?.split(' ')[1]
  )
});

const getPublicProfile = async (req, res) => res.json({
  data: await service.getPublicProfile(
    req.params.authId,
    req.get('authorization')?.split(' ')[1]
  )
});

const getAdminUser = async (req, res) => res.json({
  data: await service.getAdminUser(req.params.authId)
});

const getAccountStatus = async (req, res) => res.json({
  data: await service.getAccountStatus(req.params.authId)
});

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  updateUsername,
  me,
  resendVerification,
  verifyEmail,
  updateProfile,
  removeProfileImage,
  getProfileImage,
  unbanUser,
  getAdminStats,
  searchUsers,
  searchAdminUsers,
  getPublicProfileByUsername,
  getPublicProfile,
  getAdminUser,
  getAccountStatus
};
