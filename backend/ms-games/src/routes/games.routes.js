const express = require('express');
const controller = require('../controllers/games.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(authenticate);
router.get('/search', controller.searchGames);
router.get('/popular', controller.getPopularGames);
router.get('/by-genre/:genre', controller.getGamesByGenre);
router.get('/:igdbId', controller.getGameById);

module.exports = router;
