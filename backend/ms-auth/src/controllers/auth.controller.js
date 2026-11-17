const service = require('../services/auth.service');
const emailVerification = require('../services/email-verification.service');

const imageData = (file) => file ? {
  data: file.buffer,
  mimeType: file.mimetype
} : null;

const register = async (req, res) => res.status(201).json(await service.registerUser({
  ...(req.body || {}),
  profileImageData: imageData(req.file)
}));

const login = async (req, res) => res.json(await service.login(req.body));

const me = async (req, res) => res.json({ user: await service.getCurrentUser(req.user.sub) });


const resendVerification = async (req, res) => {
  const user = await service.getCurrentUser(req.user.sub);
  res.json(await emailVerification.sendCode(user));
};

const verifyEmail = async (req, res) => {
  const user = await service.getCurrentUser(req.user.sub);
  res.json(await emailVerification.verifyCode(user, req.body));
};

const updateProfile = async (req, res) => res.json({
  user: await service.updateProfile(req.user.sub, {
    name: req.body?.name,
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

module.exports = {
  register,
  login,
  me,
  resendVerification,
  verifyEmail,
  updateProfile,
  removeProfileImage,
  getProfileImage
};
