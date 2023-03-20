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
router.get(
  "/:id/folders",
  auth.requiredOrgMember,
  OrganizationController.getFolders
);
router.get(
  "/:id/logs",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    querySchema: OrganizationSchemas.getLogs,
  }),
  OrganizationController.getLogs
);

router.post(
  "/:id/user",
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.createNewUser,
  }),
  OrganizationController.createNewUser
);
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
router.post(
  "/:id/search",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.searchForLogs,
  }),
  OrganizationController.searchForLogs
);

export default router;
