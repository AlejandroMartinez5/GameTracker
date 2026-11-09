const { pool } = require("../config/db");

const createReport = async ({
  reporterAuthId,
  targetType,
  targetId,
  reason,
  description,
  targetSnapshot
}) => {
  const query = `
    INSERT INTO reports (
      reporter_auth_id,
      target_type,
      target_id,
      reason,
      description,
      target_snapshot
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const result = await pool.query(query, [
    reporterAuthId,
    targetType,
    targetId,
    reason,
    description,
    JSON.stringify(targetSnapshot || {})
  ]);

  return result.rows[0];
};

const findReportById = async (reportId) => {
  const result = await pool.query("SELECT * FROM reports WHERE id = $1", [
    reportId
  ]);

  return result.rows[0] || null;
};

const countReports = async ({ status, reporterAuthId }) => {
  const conditions = [];
  const values = [];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  if (reporterAuthId) {
    values.push(reporterAuthId);
    conditions.push(`reporter_auth_id = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT COUNT(*) AS total FROM reports ${whereClause}`,
    values
  );

  return Number(result.rows[0].total);
};

const findReports = async ({ status, reporterAuthId, limit, offset }) => {
  const conditions = [];
  const values = [];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  if (reporterAuthId) {
    values.push(reporterAuthId);
    conditions.push(`reporter_auth_id = $${values.length}`);
  }

  values.push(limit);
  const limitPosition = values.length;
  values.push(offset);
  const offsetPosition = values.length;

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `
    SELECT *
    FROM reports
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${limitPosition} OFFSET $${offsetPosition}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const updateReportReview = async ({
  reportId,
  status,
  reviewedByAuthId,
  adminNote
}) => {
  const query = `
    UPDATE reports
    SET status = $1,
        reviewed_by_auth_id = $2,
        admin_note = $3,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING *
  `;

  const result = await pool.query(query, [
    status,
    reviewedByAuthId,
    adminNote,
    reportId
  ]);

  return result.rows[0] || null;
};

const createModerationAction = async ({
  reportId,
  adminAuthId,
  actionType,
  targetType,
  targetId,
  note,
  metadata
}) => {
  const query = `
    INSERT INTO moderation_actions (
      report_id,
      admin_auth_id,
      action_type,
      target_type,
      target_id,
      note,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const result = await pool.query(query, [
    reportId,
    adminAuthId,
    actionType,
    targetType,
    targetId,
    note,
    JSON.stringify(metadata || {})
  ]);

  return result.rows[0];
};

const completePendingReportWithAction = async ({
  reportId,
  status,
  reviewedByAuthId,
  adminNote,
  actionType,
  targetType,
  targetId,
  note,
  metadata
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reportResult = await client.query(
      `
        UPDATE reports
        SET status = $1,
            reviewed_by_auth_id = $2,
            admin_note = $3,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
          AND status = 'PENDING'
        RETURNING *
      `,
      [status, reviewedByAuthId, adminNote, reportId]
    );

    if (!reportResult.rows[0]) {
      const error = new Error("El reporte ya fue revisado por otro administrador");
      error.status = 409;
      throw error;
    }

    const actionResult = await client.query(
      `
        INSERT INTO moderation_actions (
          report_id,
          admin_auth_id,
          action_type,
          target_type,
          target_id,
          note,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        reportId,
        reviewedByAuthId,
        actionType,
        targetType,
        targetId,
        note,
        JSON.stringify(metadata || {})
      ]
    );

    await client.query("COMMIT");

    return {
      report: reportResult.rows[0],
      action: actionResult.rows[0]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getAdminStats = async () => {
  const [
    statusResult,
    targetTypeResult,
    reasonResult,
    actionTypeResult
  ] = await Promise.all([
    pool.query(`
      SELECT status, COUNT(*)::int AS count
      FROM reports
      GROUP BY status
    `),
    pool.query(`
      SELECT target_type, COUNT(*)::int AS count
      FROM reports
      GROUP BY target_type
      ORDER BY count DESC
    `),
    pool.query(`
      SELECT reason, COUNT(*)::int AS count
      FROM reports
      GROUP BY reason
      ORDER BY count DESC, reason ASC
    `),
    pool.query(`
      SELECT action_type, COUNT(*)::int AS count
      FROM moderation_actions
      GROUP BY action_type
      ORDER BY count DESC, action_type ASC
    `)
  ]);

  const byStatus = statusResult.rows.reduce(
    (acc, row) => ({ ...acc, [row.status]: row.count }),
    { PENDING: 0, DISMISSED: 0, ACTION_TAKEN: 0 }
  );

  const totalReports =
    byStatus.PENDING + byStatus.DISMISSED + byStatus.ACTION_TAKEN;

  return {
    totalReports,
    pendingReports: byStatus.PENDING,
    resolvedReports: byStatus.DISMISSED + byStatus.ACTION_TAKEN,
    dismissedReports: byStatus.DISMISSED,
    actionTakenReports: byStatus.ACTION_TAKEN,
    reportsByStatus: byStatus,
    reportsByTargetType: targetTypeResult.rows.reduce(
      (acc, row) => ({ ...acc, [row.target_type]: row.count }),
      { USER: 0, REVIEW: 0, COMMENT: 0 }
    ),
    reportsByReason: reasonResult.rows,
    actionsTaken: actionTypeResult.rows
  };
};

module.exports = {
  createReport,
  findReportById,
  countReports,
  findReports,
  updateReportReview,
  createModerationAction,
  completePendingReportWithAction,
  getAdminStats
};
