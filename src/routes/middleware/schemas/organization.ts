import Joi from "joi";
import { objectId } from "src/utils/joiFieldValidators";

export const OrganizationSchemas = {
  createOrganization: Joi.object({
    name: Joi.string().required(),
  }),
  getLogs: Joi.object({
    folderId: Joi.string().custom(objectId).required(),
    start: Joi.number(),
    logsNoNewerThanDate: Joi.date(),
  }),
  getInvitationInfo: Joi.object({
    invitationId: Joi.string().custom(objectId).required(),
    orgSlug: Joi.string().required(),
  }),
  searchForLogs: Joi.object({
    folderId: Joi.string().custom(objectId).required(),
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
};
