const friendsRepository = require("../repositories/friends.repository");
const {
  publishFriendRequestAccepted,
  publishFriendRequestReceived,
  publishFriendRequestRejected
} = require("../utils/notification-events.util");
const {
  getPaginationParams,
  buildPaginationMeta
} = require("../utils/pagination.util");

const throwError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const validateAuthId = (authId, fieldName = "authId") => {
  const normalized = authId?.trim();

  if (!normalized) {
    throwError(`${fieldName} es obligatorio`);
  }

  return normalized;
};

const validateRequestId = (requestId) => {
  const parsed = Number(requestId);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throwError("El requestId debe ser un entero mayor a 0");
  }

  return parsed;
};

const getRelationshipLabel = (relationship, authId) => {
  if (!relationship) {
    return "NONE";
  }

  if (relationship.status === "ACCEPTED") {
    return "FRIENDS";
  }

  if (relationship.requester_auth_id === authId) {
    return "PENDING_OUTGOING";
  }

  return "PENDING_INCOMING";
};

const sendFriendRequest = async (authId, receiverAuthId) => {
  const requester = validateAuthId(authId);
  const receiver = validateAuthId(receiverAuthId, "receiverAuthId");

  if (requester === receiver) {
    throwError("No puedes enviarte una solicitud a ti mismo");
  }

  const existing = await friendsRepository.findActiveBetweenUsers(
    requester,
    receiver
  );

  if (existing) {
    if (existing.status === "ACCEPTED") {
      throwError("Ya son amigos", 409);
    }

    throwError("Ya existe una solicitud pendiente entre estos usuarios", 409);
  }

  try {
    const request = await friendsRepository.createRequest({
      requesterAuthId: requester,
      receiverAuthId: receiver
    });

    await publishFriendRequestReceived(request);

    return request;
  } catch (error) {
    if (error.code === "23505") {
      throwError("Ya existe una relacion activa entre estos usuarios", 409);
    }

    throw error;
  }
};

const acceptFriendRequest = async (authId, requestId) => {
  const receiver = validateAuthId(authId);
  const parsedRequestId = validateRequestId(requestId);
  const request = await friendsRepository.findById(parsedRequestId);

  if (!request) {
    throwError("Solicitud no encontrada", 404);
  }

  if (request.receiver_auth_id !== receiver) {
    throwError("No tienes permisos para aceptar esta solicitud", 403);
  }

  if (request.status !== "PENDING") {
    throwError("Solo se pueden aceptar solicitudes pendientes", 409);
  }

  const updatedRequest = await friendsRepository.updateStatus({
    requestId: parsedRequestId,
    status: "ACCEPTED"
  });

  await publishFriendRequestAccepted(updatedRequest);

  return updatedRequest;
};

const rejectFriendRequest = async (authId, requestId) => {
  const receiver = validateAuthId(authId);
  const parsedRequestId = validateRequestId(requestId);
  const request = await friendsRepository.findById(parsedRequestId);

  if (!request) {
    throwError("Solicitud no encontrada", 404);
  }

  if (request.receiver_auth_id !== receiver) {
    throwError("No tienes permisos para rechazar esta solicitud", 403);
  }

  if (request.status !== "PENDING") {
    throwError("Solo se pueden rechazar solicitudes pendientes", 409);
  }

  const updatedRequest = await friendsRepository.updateStatus({
    requestId: parsedRequestId,
    status: "REJECTED"
  });

  await publishFriendRequestRejected(updatedRequest);

  return updatedRequest;
};

const cancelFriendRequest = async (authId, requestId) => {
  const requester = validateAuthId(authId);
  const parsedRequestId = validateRequestId(requestId);
  const request = await friendsRepository.findById(parsedRequestId);

  if (!request) {
    throwError("Solicitud no encontrada", 404);
  }

  if (request.requester_auth_id !== requester) {
    throwError("No tienes permisos para cancelar esta solicitud", 403);
  }

  if (request.status !== "PENDING") {
    throwError("Solo se pueden cancelar solicitudes pendientes", 409);
  }

  return await friendsRepository.deletePendingRequestById(parsedRequestId);
};

const removeFriend = async (authId, friendAuthId) => {
  const user = validateAuthId(authId);
  const friend = validateAuthId(friendAuthId, "friendAuthId");

  if (user === friend) {
    throwError("friendAuthId no puede ser igual a tu authId");
  }

  const removed = await friendsRepository.deleteAcceptedBetweenUsers(user, friend);

  if (!removed) {
    throwError("Amistad no encontrada", 404);
  }

  return removed;
};

const getFriends = async (authId, paginationQuery) => {
  const user = validateAuthId(authId);
  const paginationParams = getPaginationParams(paginationQuery);
  const total = await friendsRepository.countFriends(user);
  const data = await friendsRepository.findFriends(user, paginationParams);

  return {
    data,
    pagination: buildPaginationMeta({
      page: paginationParams.page,
      limit: paginationParams.limit,
      total
    })
  };
};

const getPublicFriends = async (authId, paginationQuery) => {
  return getFriends(authId, paginationQuery);
};

const getFriendsSummary = async (authId) => {
  const user = validateAuthId(authId);
  return await friendsRepository.getFriendsSummary(user);
};

const getIncomingRequests = async (authId, paginationQuery) => {
  const user = validateAuthId(authId);
  const paginationParams = getPaginationParams(paginationQuery);
  const total = await friendsRepository.countIncomingRequests(user);
  const data = await friendsRepository.findIncomingRequests(
    user,
    paginationParams
  );

  return {
    data,
    pagination: buildPaginationMeta({
      page: paginationParams.page,
      limit: paginationParams.limit,
      total
    })
  };
};

const getOutgoingRequests = async (authId, paginationQuery) => {
  const user = validateAuthId(authId);
  const paginationParams = getPaginationParams(paginationQuery);
  const total = await friendsRepository.countOutgoingRequests(user);
  const data = await friendsRepository.findOutgoingRequests(
    user,
    paginationParams
  );

  return {
    data,
    pagination: buildPaginationMeta({
      page: paginationParams.page,
      limit: paginationParams.limit,
      total
    })
  };
};

const getRelationshipStatus = async (authId, otherAuthId) => {
  const user = validateAuthId(authId);
  const otherUser = validateAuthId(otherAuthId, "otherAuthId");

  if (user === otherUser) {
    return {
      status: "SELF",
      relationship: null
    };
  }

  const relationship = await friendsRepository.findActiveBetweenUsers(
    user,
    otherUser
  );

  return {
    status: getRelationshipLabel(relationship, user),
    relationship
  };
};

module.exports = {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
  getFriends,
  getPublicFriends,
  getFriendsSummary,
  getIncomingRequests,
  getOutgoingRequests,
  getRelationshipStatus
};
