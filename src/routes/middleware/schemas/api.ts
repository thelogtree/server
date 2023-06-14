import Joi from "joi";

export const ApiSchemas = {
  createLog: Joi.object({
    content: Joi.string().required(),
    folderPath: Joi.string().required(),
    referenceId: Joi.string().allow("").optional(),
    externalLink: Joi.string().allow("").optional(),
    additionalContext: Joi.object().optional(),
  }),
  getLogs: Joi.object({
    folderPath: Joi.string().allow("").optional(),
    referenceId: Joi.string().allow("").optional(),
  }),
  recordCall: Joi.object({
    path: Joi.string().required(),
    errorCode: Joi.string().optional().allow(""),
  }),
};
