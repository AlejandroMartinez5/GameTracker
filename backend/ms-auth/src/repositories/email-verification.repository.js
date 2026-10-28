const User = require("../models/user.model");

function issueCode(userId, hash, now, expiresAt) {
  return User.findOneAndUpdate({
    _id: userId,
    emailVerified: false,
    $or: [
      { emailVerificationSentAt: null },
      { emailVerificationSentAt: { $lte: new Date(now.getTime() - 60_000) } }
    ]
  }, { $set: {
    emailVerificationToken: hash,
    emailVerificationExpires: expiresAt,
    emailVerificationSentAt: now,
    emailVerificationAttempts: 0
  } }, { new: true }).exec();
}

function reserveAttempt(userId, now) {
  return User.findOneAndUpdate({
    _id: userId,
    emailVerified: false,
    emailVerificationToken: { $type: "string" },
    emailVerificationExpires: { $gt: now },
    emailVerificationAttempts: { $lt: 5 }
  }, { $inc: { emailVerificationAttempts: 1 } }, { new: true })
    .select("+emailVerificationToken").exec();
}

function consumeCode(userId, hash, now) {
  return User.findOneAndUpdate({
    _id: userId,
    emailVerified: false,
    emailVerificationToken: hash,
    emailVerificationExpires: { $gt: now }
  }, {
    $set: { emailVerified: true },
    $unset: { emailVerificationToken: 1, emailVerificationExpires: 1,
      emailVerificationAttempts: 1, emailVerificationSentAt: 1 }
  }, { new: true }).exec();
}

function invalidateCode(userId, hash) {
  return User.updateOne({ _id: userId, emailVerificationToken: hash }, {
    $unset: { emailVerificationToken: 1, emailVerificationExpires: 1 }
  }).exec();
}

module.exports = { issueCode, reserveAttempt, consumeCode, invalidateCode };
