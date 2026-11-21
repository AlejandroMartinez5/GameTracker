const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { uploadImage } = require('../middlewares/upload.middleware');
const moderation = require('../services/moderation.service');

router.post('/login', controller.login);
router.post('/register', uploadImage, controller.register);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);
router.put('/change-password', authenticate, controller.changePassword);
router.put('/username', authenticate, controller.updateUsername);
router.get('/me', authenticate, controller.me);
router.patch('/me/profile', authenticate, uploadImage, controller.updateProfile);
router.delete('/me/profile-image', authenticate, controller.removeProfileImage);
router.post('/email-verification/resend', authenticate, controller.resendVerification);
router.post('/email-verification/verify', authenticate, controller.verifyEmail);

router.get('/admin/stats', authenticate, moderation.requireActiveUser, moderation.requireAdmin, controller.getAdminStats);
router.get('/admin/users/:authId/status', authenticate, moderation.requireActiveUser, moderation.requireAdmin, controller.getAccountStatus);

router.get('/users/search', authenticate, moderation.requireActiveUser, controller.searchUsers);
router.get('/users/admin/search', authenticate, moderation.requireActiveUser, moderation.requireAdmin, controller.searchAdminUsers);
router.get('/users/admin/users/:authId', authenticate, moderation.requireActiveUser, moderation.requireAdmin, controller.getAdminUser);
router.get('/users/:username', authenticate, moderation.requireActiveUser, controller.getPublicProfileByUsername);
router.get('/users/:authId/profile', authenticate, moderation.requireActiveUser, controller.getPublicProfile);
router.get('/users/:authId/profile-image', authenticate, controller.getProfileImage);
router.patch('/admin/users/:authId/unban', authenticate, moderation.requireActiveUser, moderation.requireAdmin, controller.unbanUser);
router.patch('/admin/users/:authId/:action', authenticate, moderation.requireActiveUser, moderation.requireAdmin, (req, res, next) => {
  if (!['suspend', 'ban'].includes(req.params.action)) return res.status(404).json({ message: 'Ruta no encontrada' });
  return moderation.moderate(req, res, next);
});
router.delete('/admin/users/:authId/profile-photo', authenticate, moderation.requireActiveUser, moderation.requireAdmin, moderation.removeProfilePhoto);
module.exports = router;
