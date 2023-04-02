import Joi from "joi";
import { objectId } from "src/utils/joiFieldValidators";

export const OrganizationSchemas = {
  createOrganization: Joi.object({
    name: Joi.string().required(),
  }),
  getLogs: Joi.object({
    folderId: Joi.string().custom(objectId),
    isFavorites: Joi.boolean(),
    start: Joi.number(),
    logsNoNewerThanDate: Joi.date(),
    logsNoOlderThanDate: Joi.date(),
  }),
  getInvitationInfo: Joi.object({
    invitationId: Joi.string().custom(objectId).required(),
    orgSlug: Joi.string().required(),
  }),
  searchForLogs: Joi.object({
    folderId: Joi.string().custom(objectId),
    isFavorites: Joi.boolean(),
    query: Joi.string().required(),
  }),
  createNewUser: Joi.object({
    invitationId: Joi.string().custom(objectId).required(),
    email: Joi.string().required(),
    password: Joi.string().required(),
  }),
  deleteFolderAndEverythingInside: Joi.object({
    folderId: Joi.string().custom(objectId).required(),
  }),
  updateUserPermissions: Joi.object({
    userIdToUpdate: Joi.string().custom(objectId).required(),
    newPermission: Joi.string(),
    isRemoved: Joi.boolean(),
  }),
  favoriteFolder: Joi.object({
    fullPath: Joi.string().required(),
    isRemoved: Joi.boolean(),
  }),
  setFolderPreference: Joi.object({
    fullPath: Joi.string().required(),
    isMuted: Joi.boolean(),
  }),
  getFolderStats: Joi.object({
    folderId: Joi.string().custom(objectId).required(),
  }),
};
