const moderationService = require("../services/moderation.service");

const createReport = async (req, res) => {
  try {
    const report = await moderationService.createReport(
      req.body || {},
      req.user,
      req.authToken
    );

    return res.status(201).json({
      message: "Reporte creado correctamente",
      data: report
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const getMyReports = async (req, res) => {
  try {
    const result = await moderationService.getMyReports(req.user, req.query);

    return res.status(200).json({
      message: "Reportes obtenidos correctamente",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const getAdminReports = async (req, res) => {
  try {
    const result = await moderationService.getAdminReports(req.query);

    return res.status(200).json({
      message: "Reportes obtenidos correctamente",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const getAdminReportById = async (req, res) => {
  try {
    const report = await moderationService.getAdminReportById(req.params.reportId);

    return res.status(200).json({
      message: "Reporte obtenido correctamente",
      data: report
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const getAdminStats = async (req, res) => {
  try {
    const result = await moderationService.getAdminStats();

    return res.status(200).json({
      message: "Estadisticas de moderacion obtenidas correctamente",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const dismissReport = async (req, res) => {
  try {
    const result = await moderationService.dismissReport(
      {
        reportId: req.params.reportId,
        note: req.body?.note
      },
      req.user
    );

    return res.status(200).json({
      message: "Reporte descartado correctamente",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const executeAction = async (req, res) => {
  try {
    const result = await moderationService.executeAction(
      {
        reportId: req.params.reportId,
        actionType: req.body?.actionType,
        note: req.body?.note,
        duration: req.body?.duration
      },
      req.user,
      req.authToken
    );

    return res.status(200).json({
      message: "Accion de moderacion ejecutada correctamente",
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

module.exports = {
  createReport,
  getMyReports,
  getAdminReports,
  getAdminReportById,
  getAdminStats,
  dismissReport,
  executeAction
};
