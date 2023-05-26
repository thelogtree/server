import Joi from "joi";
import { objectId } from "src/utils/joiFieldValidators";

export const SlackSchemas = {
  getSlackInstallationUrl: Joi.object({
    folderId: Joi.string().custom(objectId).required(),
  }),
};
