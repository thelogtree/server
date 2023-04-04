import expressRouter from "express-promise-router";
import { ApiController } from "src/controllers/ApiController";

import auth from "../middleware/auth";
import { validateRequestAgainstSchemas } from "../middleware/helpers";
import { ApiSchemas } from "../middleware/schemas/api";

const router = expressRouter();

router.get(
  "/",
  auth.requiredApiKey,
  validateRequestAgainstSchemas({
    querySchema: ApiSchemas.getLogs,
  }),
  ApiController.getLogs
);
router.post(
  "/",
  auth.requiredApiKey,
  validateRequestAgainstSchemas({
    bodySchema: ApiSchemas.createLog,
  }),
  ApiController.createLog
);

export default router;
