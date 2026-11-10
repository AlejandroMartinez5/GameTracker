const moderationRepository = require("../repositories/moderation.repository");
const authClient = require("../clients/auth.client");
const reviewsClient = require("../clients/reviews.client");
const usersClient = require("../clients/users.client");
const {
  getPaginationParams,
  buildPaginationMeta
} = require("../utils/pagination.util");

const TARGET_TYPES = ["USER", "REVIEW", "COMMENT"];
const REASONS = [
  "SPAM",
  "OFFENSIVE_CONTENT",
  "HARASSMENT",
  "HATE_SPEECH",
  "SEXUAL_CONTENT",
  "VIOLENCE",
  "SPOILER",
  "FAKE_PROFILE",
  "INAPPROPRIATE_IMAGE",
  "OTHER"
];
const STATUSES = ["PENDING", "DISMISSED", "ACTION_TAKEN"];
const ACTION_TYPES = [
  "DISMISS_REPORT",
  "SUSPEND_USER",
  "BAN_USER",
  "DELETE_REVIEW",
  "DELETE_COMMENT",
  "REMOVE_PROFILE_IMAGE",
  "REMOVE_REVIEW_IMAGE",
  "REMOVE_COMMENT_IMAGE"
];
const SUSPENSION_DURATIONS = {
  "1_DAY": 1,
  "3_DAYS": 3,
  "7_DAYS": 7,
  "30_DAYS": 30
};

const throwBadRequest = (message) => {
  const error = new Error(message);
  error.status = 400;
  throw error;
};

function optionalText(value, field, maxLength) {
  if (value == null) return null;
  if (typeof value !== "string" || value.length > maxLength) throwBadRequest(`${field} debe ser texto de hasta ${maxLength} caracteres`);
  return value.trim() || null;
}

const normalizeEnum = (value) => typeof value === "string" ? value.trim().toUpperCase() : undefined;

const calculateSuspendedUntil = (duration) => {
  const normalizedDuration = normalizeEnum(duration);
  const days = Object.hasOwn(SUSPENSION_DURATIONS, normalizedDuration) ? SUSPENSION_DURATIONS[normalizedDuration] : null;

  if (!days) {
    throwBadRequest(
      `duration debe ser uno de: ${Object.keys(SUSPENSION_DURATIONS).join(", ")}`
    );
  }

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
};

const getAvailableActionsForReport = (report) => {
  if (!report || report.status !== "PENDING") {
    return [];
  }

  const baseActions = ["DISMISS_REPORT"];

  if (report.target_type === "USER") {
    const actions = ["SUSPEND_USER", "BAN_USER", ...baseActions];

    if (report.reason === "INAPPROPRIATE_IMAGE") {
      return ["REMOVE_PROFILE_IMAGE", ...actions];
    }

    return actions;
  }

  if (report.target_type === "REVIEW") {
    const actions = ["DELETE_REVIEW", ...baseActions];

    if (report.reason === "INAPPROPRIATE_IMAGE") {
      return ["REMOVE_REVIEW_IMAGE", ...actions];
    }

    return actions;
  }

  if (report.target_type === "COMMENT") {
    const actions = ["DELETE_COMMENT", ...baseActions];

    if (report.reason === "INAPPROPRIATE_IMAGE") {
      return ["REMOVE_COMMENT_IMAGE", ...actions];
    }

    return actions;
  }

  return baseActions;
};

const enrichReport = (report) => {
  const availableActions = getAvailableActionsForReport(report);

  return {
    ...report,
    availableActions,
    suspensionDurations: availableActions.includes("SUSPEND_USER")
      ? Object.keys(SUSPENSION_DURATIONS)
      : []
  };
};

const validateTarget = ({ targetType, targetId }) => {
  const normalizedTargetType = normalizeEnum(targetType);
  const normalizedTargetId = ["string", "number"].includes(typeof targetId) ? String(targetId).trim() : "";

  if (!TARGET_TYPES.includes(normalizedTargetType)) {
    throwBadRequest(`targetType debe ser uno de: ${TARGET_TYPES.join(", ")}`);
  }

  if (!normalizedTargetId || normalizedTargetId.length > 255) {
    throwBadRequest("targetId es obligatorio");
  }

  if (normalizedTargetType !== "USER" && (!/^\d+$/.test(normalizedTargetId) || !Number.isSafeInteger(Number(normalizedTargetId)) || Number(normalizedTargetId) < 1 || Number(normalizedTargetId) > 2147483647)) {
    throwBadRequest("targetId debe ser un entero positivo para reseñas y comentarios");
  }
  return {
    targetType: normalizedTargetType,
    targetId: normalizedTargetId
  };
};

const buildTargetSnapshot = async ({ targetType, targetId, token }) => {
  if (targetType === "USER") {
    const profile = await usersClient.getPublicProfile({
      authId: targetId,
      token
    });

    return {
      type: "USER",
      authId: profile.authId,
      name: profile.name,
      username: profile.username,
      profileImage: profile.profileImage,
      createdAt: profile.createdAt
    };
  }

  if (targetType === "REVIEW") {
    const review = await reviewsClient.getReview({
      reviewId: targetId,
      token
    });

    return {
      type: "REVIEW",
      id: review.id,
      authId: review.auth_id,
      igdbId: review.igdb_id,
      rating: review.rating,
      title: review.title,
      content: review.content,
      imageUrl: review.image_url,
      createdAt: review.created_at,
      updatedAt: review.updated_at
    };
  }

  if (targetType === "COMMENT") {
    const comment = await reviewsClient.getComment({
      commentId: targetId,
      token
    });

    return {
      type: "COMMENT",
      id: comment.id,
      reviewId: comment.review_id,
      authId: comment.auth_id,
      content: comment.content,
      imageUrl: comment.image_url,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at
    };
  }

  return {};
};

const getReportOrThrow = async (reportId) => {
  if (!Number.isSafeInteger(Number(reportId)) || Number(reportId) < 1 || Number(reportId) > 2147483647) {
    throwBadRequest("reportId debe ser valido");
  }

  const report = await moderationRepository.findReportById(Number(reportId));

  if (!report) {
    const error = new Error("Reporte no encontrado");
    error.status = 404;
    throw error;
  }

  return report;
};

const createReport = async (
  { targetType, targetId, reason, description },
  user,
  token
) => {
  const normalizedReason = normalizeEnum(reason);
  const normalizedDescription = optionalText(description, "description", 5000);
  const target = validateTarget({ targetType, targetId });

  if (!REASONS.includes(normalizedReason)) {
    throwBadRequest(`reason debe ser uno de: ${REASONS.join(", ")}`);
  }

  if (target.targetType === "USER" && target.targetId === user.authId) {
    throwBadRequest("No puedes reportar tu propio perfil");
  }

  const targetSnapshot = await buildTargetSnapshot({
    targetType: target.targetType,
    targetId: target.targetId,
    token
  });

  try {
    return await moderationRepository.createReport({
      reporterAuthId: user.authId,
      targetType: target.targetType,
      targetId: target.targetId,
      reason: normalizedReason,
      description: normalizedDescription,
      targetSnapshot
    });
  } catch (error) {
    if (error.code === "23505") {
      const customError = new Error("Ya tienes un reporte pendiente para este contenido");
      customError.status = 409;
      throw customError;
    }

    throw error;
  }
};

const getMyReports = async (user, query) => {
  const paginationParams = getPaginationParams(query);
  const total = await moderationRepository.countReports({
    reporterAuthId: user.authId
  });
  const reports = await moderationRepository.findReports({
    reporterAuthId: user.authId,
    ...paginationParams
  });

  return {
    reports,
    pagination: buildPaginationMeta({
      page: paginationParams.page,
      limit: paginationParams.limit,
      total
    })
  };
};

const getAdminReports = async (query = {}) => {
  const paginationParams = getPaginationParams(query);
  const status = query.status ? normalizeEnum(query.status) : "PENDING";

  if (status !== "ALL" && !STATUSES.includes(status)) {
    throwBadRequest(`status debe ser ALL o uno de: ${STATUSES.join(", ")}`);
  }

  const statusFilter = status === "ALL" ? null : status;
  const total = await moderationRepository.countReports({
    status: statusFilter
  });
  const reports = await moderationRepository.findReports({
    status: statusFilter,
    ...paginationParams
  });

  return {
    reports: reports.map(enrichReport),
    pagination: buildPaginationMeta({
      page: paginationParams.page,
      limit: paginationParams.limit,
      total
    })
  };
};

const getAdminReportById = async (reportId) => {
  const report = await getReportOrThrow(reportId);
  return enrichReport(report);
};

const getAdminStats = async () => {
  return moderationRepository.getAdminStats();
};

const dismissReport = async ({ reportId, note }, admin) => {
  const report = await getReportOrThrow(reportId);

  if (report.status !== "PENDING") {
    throwBadRequest("Solo se pueden descartar reportes pendientes");
  }

  const result = await moderationRepository.completePendingReportWithAction({
    reportId: report.id,
    status: "DISMISSED",
    reviewedByAuthId: admin.authId,
    adminNote: optionalText(note, "note", 2000),
    actionType: "DISMISS_REPORT",
    targetType: report.target_type,
    targetId: report.target_id,
    note: optionalText(note, "note", 2000),
    metadata: {}
  });

  return result;
};

const executeAction = async ({ reportId, actionType, note, duration }, admin, token) => {
  const normalizedActionType = normalizeEnum(actionType);

  if (!ACTION_TYPES.includes(normalizedActionType)) {
    throwBadRequest(`actionType debe ser uno de: ${ACTION_TYPES.join(", ")}`);
  }

  if (normalizedActionType === "DISMISS_REPORT") {
    return dismissReport({ reportId, note }, admin);
  }

  const report = await getReportOrThrow(reportId);

  if (report.status !== "PENDING") {
    throwBadRequest("Solo se pueden tomar acciones sobre reportes pendientes");
  }

  if (
    ["SUSPEND_USER", "BAN_USER"].includes(normalizedActionType) &&
    report.target_type !== "USER"
  ) {
    throwBadRequest("Esta accion solo aplica para reportes de perfil");
  }

  if (
    normalizedActionType === "DELETE_REVIEW" &&
    report.target_type !== "REVIEW"
  ) {
    throwBadRequest("Esta accion solo aplica para reportes de resena");
  }

  if (
    normalizedActionType === "DELETE_COMMENT" &&
    report.target_type !== "COMMENT"
  ) {
    throwBadRequest("Esta accion solo aplica para reportes de comentario");
  }

  if (
    normalizedActionType === "REMOVE_PROFILE_IMAGE" &&
    report.target_type !== "USER"
  ) {
    throwBadRequest("Esta accion solo aplica para reportes de perfil");
  }

  if (
    normalizedActionType === "REMOVE_REVIEW_IMAGE" &&
    report.target_type !== "REVIEW"
  ) {
    throwBadRequest("Esta accion solo aplica para reportes de resena");
  }

  if (
    normalizedActionType === "REMOVE_COMMENT_IMAGE" &&
    report.target_type !== "COMMENT"
  ) {
    throwBadRequest("Esta accion solo aplica para reportes de comentario");
  }

  let externalResult = null;
  const normalizedNote = optionalText(note, "note", 2000);
  let suspendedUntil = null;

  if (normalizedActionType === "SUSPEND_USER") {
    suspendedUntil = calculateSuspendedUntil(duration);

    externalResult = await authClient.suspendUser({
      authId: report.target_id,
      suspendedUntil,
      reason: normalizedNote,
      token
    });
  }

  if (normalizedActionType === "BAN_USER") {
    externalResult = await authClient.banUser({
      authId: report.target_id,
      reason: normalizedNote,
      token
    });
  }

  if (normalizedActionType === "DELETE_REVIEW") {
    externalResult = await reviewsClient.deleteReview({
      reviewId: report.target_id,
      token
    });
  }

  if (normalizedActionType === "DELETE_COMMENT") {
    externalResult = await reviewsClient.deleteComment({
      commentId: report.target_id,
      token
    });
  }

  if (normalizedActionType === "REMOVE_PROFILE_IMAGE") {
    externalResult = await usersClient.removeProfilePhoto({
      authId: report.target_id,
      token
    });
  }

  if (normalizedActionType === "REMOVE_REVIEW_IMAGE") {
    externalResult = await reviewsClient.removeReviewImage({
      reviewId: report.target_id,
      token
    });
  }

  if (normalizedActionType === "REMOVE_COMMENT_IMAGE") {
    externalResult = await reviewsClient.removeCommentImage({
      commentId: report.target_id,
      token
    });
  }

  const result = await moderationRepository.completePendingReportWithAction({
    reportId: report.id,
    status: "ACTION_TAKEN",
    reviewedByAuthId: admin.authId,
    adminNote: normalizedNote,
    actionType: normalizedActionType,
    targetType: report.target_type,
    targetId: report.target_id,
    note: normalizedNote,
    metadata: {
      externalResult,
      suspendedUntil: suspendedUntil || null
    }
  });

  return result;
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
