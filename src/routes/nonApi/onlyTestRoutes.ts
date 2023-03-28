import expressRouter from "express-promise-router";
import auth from "../middleware/auth";
import { OnlyTestController } from "src/controllers/OnlyTestController";

const router = expressRouter();

router.get(
  "/:id/required-org-member",
  auth.requiredOrgMember,
  OnlyTestController.autoSuccess
);
router.get(
  "/:id/required-org-admin",
  auth.requiredOrgAdmin,
  OnlyTestController.autoSuccess
);
router.get("/required-user", auth.requiredUser, OnlyTestController.autoSuccess);
router.get(
  "/required-api-key",
  auth.requiredApiKey,
  OnlyTestController.autoSuccess
);
router.get(
  "/required-admin",
  auth.requiredAdminUser,
  OnlyTestController.autoSuccess
);

export default router;
