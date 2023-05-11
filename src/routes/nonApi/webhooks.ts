import expressRouter from "express-promise-router";
import { WebhooksController } from "src/controllers/WebhooksController";

const router = expressRouter();

router.post(
  "/intercom/removed-connection",
  WebhooksController.removedIntercomConnection
);

export default router;
