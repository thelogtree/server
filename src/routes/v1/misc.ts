import expressRouter from "express-promise-router";
import { ApiController } from "src/controllers/ApiController";

import auth from "../middleware/auth";

const router = expressRouter();

router.get(
  "/zapier-test",
  auth.requiredApiKey,
  ApiController.testZapierConnection
);

export default router;
