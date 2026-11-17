const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { uploadImage } = require('../middlewares/upload.middleware');

router.post('/login', controller.login);
router.post('/register', uploadImage, controller.register);
router.get('/me', authenticate, controller.me);
router.patch('/me/profile', authenticate, uploadImage, controller.updateProfile);
router.delete('/me/profile-image', authenticate, controller.removeProfileImage);
router.post('/email-verification/resend', authenticate, controller.resendVerification);
router.post('/email-verification/verify', authenticate, controller.verifyEmail);
const moderation = require('../services/moderation.service');
router.get('/users/:authId/profile', authenticate, moderation.requireActiveUser, moderation.getPublicProfile);
router.get('/users/:authId/profile-image', authenticate, controller.getProfileImage);
router.patch('/admin/users/:authId/:action', authenticate, moderation.requireActiveUser, moderation.requireAdmin, (req, res, next) => {
  if (!['suspend', 'ban'].includes(req.params.action)) return res.status(404).json({ message: 'Ruta no encontrada' });
  return moderation.moderate(req, res, next);
});
router.delete('/admin/users/:authId/profile-photo', authenticate, moderation.requireActiveUser, moderation.requireAdmin, moderation.removeProfilePhoto);
module.exports = router;
