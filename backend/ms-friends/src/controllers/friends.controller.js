const authService = require("../services/auth.service");

const healthCheck = async (req, res) => {
  return res.status(200).json({
    message: "ms-auth funcionando 🚀"
  });
};

const register = async (req, res) => {
  try {
    const { email, password, name, username, profileImage } = req.body;

    if (!email || !password || !name || !username) {
      return res.status(400).json({
        message: "email, password, name y username son obligatorios"
      });
    }

    const result = await authService.register({
      email,
      password,
      name,
      username,
      profileImage
    });

    return res.status(201).json({
      message: "Usuario registrado correctamente",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "email y password son obligatorios"
      });
    }

    const result = await authService.login({ email, password });

    return res.status(200).json({
      message: "Login exitoso",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    const result = await authService.verifyEmail({ email, code });

    return res.status(200).json({
      message: "Correo verificado correctamente",
      data: result
    });
  } catch (error) {
    const response = {
      message: error.message || "Error interno del servidor"
    };

    if (error.data) {
      response.data = error.data;
    }

    return res.status(error.status || 500).json(response);
  }
};

const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    await authService.resendVerificationEmail({ email });

    return res.status(200).json({
      message: "Si el correo existe y no esta verificado, se enviaron instrucciones"
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    await authService.forgotPassword({ email });

    return res.status(200).json({
      message: "Si el correo existe, se enviaron instrucciones para recuperar la contrasena"
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, code, password } = req.body;

    await authService.resetPassword({ token: token || code, password });

    return res.status(200).json({
      message: "Contrasena actualizada correctamente"
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const authId = req.user.authId;
    const { currentPassword, newPassword } = req.body;

    await authService.changePassword({
      authId,
      currentPassword,
      newPassword
    });

    return res.status(200).json({
      message: "Contrasena cambiada correctamente"
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const updateUsername = async (req, res) => {
  try {
    const authId = req.user.authId;
    const { username } = req.body;

    const result = await authService.updateUsername({
      authId,
      username
    });

    return res.status(200).json({
      message: "Username actualizado correctamente",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const getAccountStatus = async (req, res) => {
  try {
    const { authId } = req.params;

    const result = await authService.getAccountStatus(authId);

    return res.status(200).json({
      message: "Estado de cuenta obtenido correctamente",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const getAdminStats = async (req, res) => {
  try {
    const result = await authService.getAdminStats();

    return res.status(200).json({
      message: "Estadisticas de usuarios obtenidas correctamente",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const suspendUser = async (req, res) => {
  try {
    const { authId } = req.params;
    const { suspendedUntil, reason } = req.body;

    const result = await authService.suspendUser({
      authId,
      suspendedUntil,
      reason,
      adminAuthId: req.user.authId
    });

    return res.status(200).json({
      message: "Usuario suspendido correctamente",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const banUser = async (req, res) => {
  try {
    const { authId } = req.params;
    const { reason } = req.body;

    const result = await authService.banUser({
      authId,
      reason,
      adminAuthId: req.user.authId
    });

    return res.status(200).json({
      message: "Usuario baneado correctamente",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const unbanUser = async (req, res) => {
  try {
    const { authId } = req.params;

    const result = await authService.unbanUser({
      authId,
      adminAuthId: req.user.authId
    });

    return res.status(200).json({
      message: "Usuario reactivado correctamente",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

module.exports = {
  healthCheck,
  register,
  login,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  updateUsername,
  getAccountStatus,
  getAdminStats,
  suspendUser,
  banUser,
  unbanUser
};
