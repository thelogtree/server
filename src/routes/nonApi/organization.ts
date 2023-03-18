import expressRouter from "express-promise-router";
import { OrganizationController } from "src/controllers/OrganizationController";

import auth from "../middleware/auth";
import { validateRequestAgainstSchemas } from "../middleware/helpers";
import { OrganizationSchemas } from "../middleware/schemas/organization";

const router = expressRouter();

// only uncomment when running locally to create an organization
// router.post(
//   "/",
//   validateRequestAgainstSchemas({
//     bodySchema: OrganizationSchemas.createOrganization,
//   }),
//   OrganizationController.createOrganization
// );

router.get("/me", auth.requiredUser, OrganizationController.getMe);

router.post(
  "/:id/secret-key",
  auth.requiredOrgMember,
  OrganizationController.generateSecretKey
);
router.post(
  "/:id/invite-link",
  auth.requiredOrgMember,
  OrganizationController.generateInviteLink
);

export default router;
