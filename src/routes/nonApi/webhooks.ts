import expressRouter from "express-promise-router";
import { WebhooksController } from "src/controllers/WebhooksController";

const router = expressRouter();

router.post("/intercom", WebhooksController.intercomWebhook);
router.post("/intercom/uninstall", WebhooksController.intercomUninstallWebhook);

export default router;
