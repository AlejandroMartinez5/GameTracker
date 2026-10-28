const router = require("express").Router();
const { authenticate } = require("../middlewares/auth.middleware");

// Declarar las rutas de amigos después de este middleware.
router.use(authenticate);

module.exports = router;
