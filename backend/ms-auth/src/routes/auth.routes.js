const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
router.post('/login', controller.login);
router.post('/register', controller.register);
router.get('/me', authenticate, controller.me);
module.exports = router;
