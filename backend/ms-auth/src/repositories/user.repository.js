const User = require('../models/user.model');
const normalize = value => value.trim().toLowerCase();

const createUser = ({
  email,
  username,
  passwordHash,
  name,
  profileImageData,
  profileImageMimeType
}) => User.create({
  email: normalize(email),
  username: normalize(username),
  password: passwordHash,
  name,
  profileImageData,
  profileImageMimeType
});

const findByEmail = email => User.findOne({ email: normalize(email) }).exec();

const findByUsername = username => User.findOne({ username: normalize(username) }).exec();

const findById = id => User.findById(id).exec();

const findCredentialsByEmail = email => User.findOne({ email: normalize(email) }).select('+password').exec();

const findCredentialsById = id => User.findById(id).select('+password').exec();

const setPasswordResetToken = (id, token, expires) => User.findByIdAndUpdate(id, {
  $set: {
    passwordResetToken: token,
    passwordResetExpires: expires
  }
}, { new: true, runValidators: true }).exec();

const clearPasswordResetToken = id => User.findByIdAndUpdate(id, {
  $unset: { passwordResetToken: 1, passwordResetExpires: 1 }
}, { new: true }).exec();

const findByPasswordResetToken = token => User.findOne({
  passwordResetToken: token,
  passwordResetExpires: { $gt: new Date() }
}).select('+passwordResetToken').exec();

const consumePasswordResetToken = (token, passwordHash) => User.findOneAndUpdate({
  passwordResetToken: token,
  passwordResetExpires: { $gt: new Date() }
}, {
  $set: { password: passwordHash },
  $unset: { passwordResetToken: 1, passwordResetExpires: 1 }
}, { new: true, runValidators: true }).exec();

const updateAccountStatus = (id, changes) => User.findByIdAndUpdate(
  id,
  { $set: changes },
  { new: true, runValidators: true }
).exec();

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const searchUsers = (query, limit) => {
  const expression = new RegExp(escapeRegex(query), "i");

  return User.find({
    $or: [
      { username: expression },
      { name: expression },
      { email: expression }
    ]
  })
    .sort({ username: 1 })
    .limit(limit)
    .exec();
};

const getAdminStats = async () => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const last7Days = new Date(now);
  last7Days.setDate(last7Days.getDate() - 7);

  const last30Days = new Date(now);
  last30Days.setDate(last30Days.getDate() - 30);

  const [
    totalUsers,
    newUsersToday,
    newUsersLast7Days,
    newUsersLast30Days,
    statusRows,
    roleRows,
    verificationRows
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: startOfToday } }),
    User.countDocuments({ createdAt: { $gte: last7Days } }),
    User.countDocuments({ createdAt: { $gte: last30Days } }),
    User.aggregate([{ $group: { _id: "$accountStatus", count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: "$emailVerified", count: { $sum: 1 } } }])
  ]);

  return {
    totalUsers,
    newUsers: {
      today: newUsersToday,
      last7Days: newUsersLast7Days,
      last30Days: newUsersLast30Days
    },
    byStatus: statusRows.reduce(
      (result, row) => ({ ...result, [row._id || "UNKNOWN"]: row.count }),
      { ACTIVE: 0, SUSPENDED: 0, BANNED: 0 }
    ),
    byRole: roleRows.reduce(
      (result, row) => ({ ...result, [row._id || "UNKNOWN"]: row.count }),
      { USER: 0, ADMIN: 0 }
    ),
    byEmailVerification: verificationRows.reduce(
      (result, row) => ({
        ...result,
        [row._id ? "verified" : "unverified"]: row.count
      }),
      { verified: 0, unverified: 0 }
    )
  };
};

const updateUserById = (id, {
  name,
  username,
  profileImageData,
  profileImageMimeType
}) => {
  const changes = {};
  if (name !== undefined) changes.name = name;
  if (username !== undefined) changes.username = normalize(username);
  if (profileImageData !== undefined) changes.profileImageData = profileImageData;
  if (profileImageMimeType !== undefined) changes.profileImageMimeType = profileImageMimeType;
  return User.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true }).exec();
};

const findProfileImageById = id => User.findById(id)
  .select('+profileImageData +profileImageMimeType')
  .exec();

const updatePassword = (id, previousHash, passwordHash) => User.findOneAndUpdate({ _id: id, password: previousHash }, {
  $set: { password: passwordHash }, $unset: { passwordResetToken: 1, passwordResetExpires: 1 }
}, { new: true, runValidators: true }).exec();

const deleteById = id => User.deleteOne({ _id: id }).exec();
module.exports = {
  createUser,
  findByEmail,
  findByUsername,
  findById,
  findCredentialsByEmail,
  findCredentialsById,
  setPasswordResetToken,
  clearPasswordResetToken,
  findByPasswordResetToken,
  consumePasswordResetToken,
  updateAccountStatus,
  searchUsers,
  getAdminStats,
  findProfileImageById,
  updateUserById,
  updatePassword,
  deleteById
};
