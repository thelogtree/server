import Joi from "joi";
import { objectId } from "src/utils/joiFieldValidators";

export const OrganizationSchemas = {
  createOrganization: Joi.object({
    name: Joi.string().required(),
  }),
  getLogs: Joi.object({
    folderId: Joi.string().custom(objectId).required(),
    start: Joi.number(),
  }),
  searchForLogs: Joi.object({
    folderId: Joi.string().custom(objectId).required(),
    query: Joi.string().required(),
  }),
};
