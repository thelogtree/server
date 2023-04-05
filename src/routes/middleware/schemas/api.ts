import Joi from "joi";

export const ApiSchemas = {
  createLog: Joi.object({
    content: Joi.string().required(),
    folderPath: Joi.string().required(),
    referenceId: Joi.string().allow("").optional(),
    externalLink: Joi.string().allow("").optional(),
  }),
  getLogs: Joi.object({
    folderPath: Joi.string().allow("").optional(),
    referenceId: Joi.string().allow("").optional(),
  }),
};
