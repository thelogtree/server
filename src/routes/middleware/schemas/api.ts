import Joi from "joi";

export const ApiSchemas = {
  createLog: Joi.object({
    content: Joi.string().required(),
    folderPath: Joi.string().required(),
    referenceId: Joi.string().allow("").optional(),
  }),
};
