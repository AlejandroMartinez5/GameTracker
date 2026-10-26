const User = require('../models/user.model');
const normalize = value => value.trim().toLowerCase();

const createUser = ({ email, username, passwordHash, name, profileImage }) => User.create({
  email: normalize(email), username: normalize(username), password: passwordHash, name, profileImage
});

const findByEmail = email => User.findOne({ email: normalize(email) }).exec();

const findByUsername = username => User.findOne({ username: normalize(username) }).exec();

const findById = id => User.findById(id).exec();

const findCredentialsByEmail = email => User.findOne({ email: normalize(email) }).select('+password').exec();

const findCredentialsById = id => User.findById(id).select('+password').exec();

const updateUserById = (id, { name, profileImage }) => {
  const changes = {};
  if (name !== undefined) changes.name = name;
  if (profileImage !== undefined) changes.profileImage = profileImage;
  return User.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true }).exec();
};

const updatePassword = (id, previousHash, passwordHash) => User.findOneAndUpdate({ _id: id, password: previousHash }, {
  $set: { password: passwordHash }, $unset: { passwordResetToken: 1, passwordResetExpires: 1 }
}, { new: true, runValidators: true }).exec();

const deleteById = id => User.deleteOne({ _id: id }).exec();
module.exports = { createUser, findByEmail, findByUsername, findById, findCredentialsByEmail, findCredentialsById, updateUserById, updatePassword, deleteById };
