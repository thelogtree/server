import expressRouter from "express-promise-router";
import { ApiController } from "src/controllers/ApiController";

import auth from "../middleware/auth";
import { validateRequestAgainstSchemas } from "../middleware/helpers";
import { ApiSchemas } from "../middleware/schemas/api";

const router = expressRouter();

router.post(
  "/track",
  auth.requiredApiKey,
  validateRequestAgainstSchemas({
    bodySchema: ApiSchemas.recordCall,
  }),
  ApiController.recordCall
);

export default router;
