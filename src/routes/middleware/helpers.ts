import { NextFunction, Request, Response } from "express";
import Joi from "joi";
import { ApiError } from "src/utils/errors";
import { objectId } from "src/utils/joiFieldValidators";

type SchemaInputs = {
  bodySchema?: Joi.ObjectSchema<any>;
  querySchema?: Joi.ObjectSchema<any>;
  paramSchema?: Joi.ObjectSchema<any>;
};

export const validateRequestAgainstSchemas =
  (schemaInputs: SchemaInputs) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (schemaInputs.bodySchema) {
      const { error } = schemaInputs.bodySchema.validate(req.body);
      if (error) {
        throw new ApiError(error.message);
      }
    }
    if (schemaInputs.paramSchema) {
      const { error } = schemaInputs.paramSchema.validate(req.params);
      if (error) {
        throw new ApiError(error.message);
      }
    }
    if (schemaInputs.querySchema) {
      const { error } = schemaInputs.querySchema.validate(req.query);
      if (error) {
        throw new ApiError(error.message);
      }
    }
    next();
  };

// reusable id path param schema
export const IdPathParamSchema = Joi.object({
  id: Joi.string().required().custom(objectId),
});
