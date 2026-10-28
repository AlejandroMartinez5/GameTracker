const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.post('/login', controller.login);
router.post('/register', controller.register);
router.get('/me', authenticate, controller.me);
router.post('/email-verification/resend', authenticate, controller.resendVerification);
router.post('/email-verification/verify', authenticate, controller.verifyEmail);
module.exports = router;
