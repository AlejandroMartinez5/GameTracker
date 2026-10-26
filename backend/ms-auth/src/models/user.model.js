const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    profileImage: { type: String, default: null },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER"
    },
    accountStatus: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "BANNED"],
      default: "ACTIVE"
    },
    suspendedUntil: {
      type: Date,
      default: null
    },
    moderationReason: {
      type: String,
      default: null
    },
    moderatedAt: {
      type: Date,
      default: null
    },
    moderatedByAuthId: {
      type: String,
      default: null
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String,
      select: false,
      default: null
    },
    emailVerificationExpires: {
      type: Date,
      default: null
    },
    passwordResetToken: {
      type: String,
      select: false,
      default: null
    },
    passwordResetExpires: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, result) => {
        delete result.password;
        delete result.emailVerificationToken;
        delete result.passwordResetToken;
        return result;
      }
    }
  }
);

module.exports = mongoose.model("User", userSchema);
