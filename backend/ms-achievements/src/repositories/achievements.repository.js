const { pool } = require("../config/db");

const METRIC_COLUMNS = {
  reviews: "reviews_count",
  comments: "comments_count",
  likes: "likes_count",
  friendships: "friendships_count"
};

const HANDLED_EVENTS = new Set([
  "user.created",
  "ReviewCreated",
  "ReviewDeletedForAchievements",
  "CommentCreated",
  "CommentDeletedForAchievements",
  "ReviewLiked",
  "ReviewUnliked",
  "CommentLiked",
  "CommentUnliked",
  "FriendAccepted",
  "FriendRemoved"
]);

const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const ensureUser = async (client, authId, registeredAt = null) => {
  if (!authId) return null;

  const result = await client.query(
    `INSERT INTO achievement_users (auth_id, registered_at)
     VALUES ($1, $2)
     ON CONFLICT (auth_id) DO UPDATE SET
       registered_at = COALESCE(achievement_users.registered_at, EXCLUDED.registered_at),
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [String(authId), registeredAt]
  );

  return result.rows[0];
};

const unlockMetricAchievements = async (client, authId, metric, currentValue) => {
  const result = await client.query(
    `WITH inserted AS (
       INSERT INTO user_achievements (auth_id, achievement_code)
       SELECT $1, code
       FROM achievement_definitions
       WHERE metric = $2 AND threshold IS NOT NULL AND threshold <= $3
       ON CONFLICT (auth_id, achievement_code) DO NOTHING
       RETURNING auth_id, achievement_code, unlocked_at
     )
     SELECT inserted.auth_id AS "authId", inserted.achievement_code AS code,
            inserted.unlocked_at AS "unlockedAt", definitions.category,
            definitions.metric, definitions.threshold,
            definitions.duration_seconds AS "durationSeconds",
            definitions.name, definitions.description
     FROM inserted
     JOIN achievement_definitions definitions
       ON definitions.code = inserted.achievement_code`,
    [String(authId), metric, currentValue]
  );

  return result.rows;
};

const adjustMetric = async (client, authId, metric, delta) => {
  const column = METRIC_COLUMNS[metric];
  if (!column || !authId || !delta) return [];

  await ensureUser(client, authId);
  const result = await client.query(
    `UPDATE achievement_users
     SET ${column} = GREATEST(${column} + $2, 0), updated_at = CURRENT_TIMESTAMP
     WHERE auth_id = $1
     RETURNING ${column}`,
    [String(authId), delta]
  );

  if (result.rows[0]) {
    return unlockMetricAchievements(client, authId, metric, result.rows[0][column]);
  }

  return [];
};

const processEvent = async (event) => {
  if (!event?.eventId || !event.type) return { processed: false };
  if (!HANDLED_EVENTS.has(event.type)) return { processed: false, ignored: true };

  return withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO achievement_processed_events (event_id, event_type)
       VALUES ($1, $2)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [String(event.eventId), String(event.type)]
    );

    if (!inserted.rowCount) return { processed: false, duplicate: true };

    const payload = event.payload || {};
    const unlocked = [];
    const addUnlocked = (items) => unlocked.push(...items);
    switch (event.type) {
      case "user.created":
        await ensureUser(client, payload.authId, event.occurredAt || new Date().toISOString());
        break;
      case "ReviewCreated":
        addUnlocked(await adjustMetric(client, payload.actorAuthId, "reviews", 1));
        break;
      case "ReviewDeletedForAchievements":
        addUnlocked(await adjustMetric(client, payload.authorAuthId, "reviews", -1));
        break;
      case "CommentCreated":
        addUnlocked(await adjustMetric(client, payload.authorAuthId, "comments", 1));
        break;
      case "CommentDeletedForAchievements":
        addUnlocked(await adjustMetric(client, payload.authorAuthId, "comments", -1));
        break;
      case "ReviewLiked":
        addUnlocked(await adjustMetric(client, payload.recipientAuthId, "likes", 1));
        break;
      case "ReviewUnliked":
        addUnlocked(await adjustMetric(client, payload.ownerAuthId, "likes", -1));
        break;
      case "CommentLiked":
        addUnlocked(await adjustMetric(client, payload.recipientAuthId, "likes", 1));
        break;
      case "CommentUnliked":
        addUnlocked(await adjustMetric(client, payload.ownerAuthId, "likes", -1));
        break;
      case "FriendAccepted":
        addUnlocked(await adjustMetric(client, payload.requesterAuthId, "friendships", 1));
        addUnlocked(await adjustMetric(client, payload.receiverAuthId, "friendships", 1));
        break;
      case "FriendRemoved":
        addUnlocked(await adjustMetric(client, payload.requesterAuthId, "friendships", -1));
        addUnlocked(await adjustMetric(client, payload.receiverAuthId, "friendships", -1));
        break;
      default:
        break;
    }

    return { processed: true, duplicate: false, unlocked };
  });
};

const evaluateTenureAchievements = async () => {
  const result = await pool.query(
    `WITH inserted AS (
       INSERT INTO user_achievements (auth_id, achievement_code)
       SELECT users.auth_id, definitions.code
       FROM achievement_users users
       CROSS JOIN achievement_definitions definitions
       WHERE definitions.metric = 'account_age'
         AND users.registered_at IS NOT NULL
         AND users.registered_at <= NOW() - (definitions.duration_seconds * INTERVAL '1 second')
       ON CONFLICT (auth_id, achievement_code) DO NOTHING
       RETURNING auth_id, achievement_code, unlocked_at
     )
     SELECT inserted.auth_id AS "authId", inserted.achievement_code AS code,
            inserted.unlocked_at AS "unlockedAt", definitions.category,
            definitions.metric, definitions.threshold,
            definitions.duration_seconds AS "durationSeconds",
            definitions.name, definitions.description
     FROM inserted
     JOIN achievement_definitions definitions
       ON definitions.code = inserted.achievement_code`
  );

  return result.rows;
};

const getDefinitions = async () => {
  const result = await pool.query(
    `SELECT code, category, metric, threshold, duration_seconds AS "durationSeconds", name, description
     FROM achievement_definitions
     ORDER BY sort_order`
  );
  return result.rows;
};

const getUserSummary = async (authId) => {
  const userResult = await pool.query(
    `SELECT auth_id AS "authId", reviews_count AS "reviewsCount", comments_count AS "commentsCount",
            likes_count AS "likesCount", friendships_count AS "friendshipsCount", registered_at AS "registeredAt"
     FROM achievement_users WHERE auth_id = $1`,
    [String(authId)]
  );
  const unlockedResult = await pool.query(
    `SELECT achievement_code AS code, unlocked_at AS "unlockedAt"
     FROM user_achievements WHERE auth_id = $1 ORDER BY unlocked_at ASC`,
    [String(authId)]
  );

  const user = userResult.rows[0] || {
    authId: String(authId),
    reviewsCount: 0,
    commentsCount: 0,
    likesCount: 0,
    friendshipsCount: 0,
    registeredAt: null
  };
  const unlocked = new Map(unlockedResult.rows.map((item) => [item.code, item.unlockedAt]));
  const definitions = await getDefinitions();
  const counters = {
    reviews: user.reviewsCount,
    comments: user.commentsCount,
    likes: user.likesCount,
    friendships: user.friendshipsCount
  };
  const now = Date.now();

  return {
    authId: user.authId,
    registeredAt: user.registeredAt,
    counters,
    achievements: definitions.map((definition) => {
      const progress = definition.metric === "account_age"
        ? user.registeredAt ? Math.max(0, Math.floor((now - new Date(user.registeredAt).getTime()) / 1000)) : 0
        : counters[definition.metric];
      return {
        ...definition,
        progress,
        unlocked: unlocked.has(definition.code),
        unlockedAt: unlocked.get(definition.code) || null
      };
    })
  };
};

module.exports = {
  processEvent,
  evaluateTenureAchievements,
  getDefinitions,
  getUserSummary
};
