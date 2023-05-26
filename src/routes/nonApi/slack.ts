import expressRouter from "express-promise-router";
import { SlackController } from "src/controllers/SlackController";
import { validateRequestAgainstSchemas } from "../middleware/helpers";
import { SlackSchemas } from "../middleware/schemas/slack";

const router = expressRouter();

router.get("/oauth-redirect", SlackController.handleOauthRedirect);
router.get(
  "/installation-url",
  validateRequestAgainstSchemas({
    querySchema: SlackSchemas.getSlackInstallationUrl,
  }),
  SlackController.handleGetInstallationUrl
);
router.post("/slash-command", SlackController.handleSlashCommand);

export default router;
