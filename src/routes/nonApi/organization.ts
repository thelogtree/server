import expressRouter from "express-promise-router";
import { OrganizationController } from "src/controllers/OrganizationController";

import auth from "../middleware/auth";
import { validateRequestAgainstSchemas } from "../middleware/helpers";
import { OrganizationSchemas } from "../middleware/schemas/organization";
import { rateLimiterP1 } from "src/utils/rateLimiters";

const router = expressRouter();

// only uncomment when running locally to create an organization
// router.post(
//   "/",
//   validateRequestAgainstSchemas({
//     bodySchema: OrganizationSchemas.createOrganization,
//   }),
//   OrganizationController.createOrganization
// );

router.get(
  "/invitation",
  validateRequestAgainstSchemas({
    querySchema: OrganizationSchemas.getInvitationInfo,
  }),
  OrganizationController.getInvitationInfo
);
router.get("/me", auth.requiredUser, OrganizationController.getMe);
router.get(
  "/:id",
  auth.requiredOrgMember,
  OrganizationController.getOrganization
);
router.get(
  "/:id/team",
  auth.requiredOrgMember,
  OrganizationController.getOrganizationMembers
);
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
router.get(
  "/:id/folder-stats",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    querySchema: OrganizationSchemas.getFolderStats,
  }),
  OrganizationController.getFolderStats
);
router.get(
  "/:id/insights",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    querySchema: OrganizationSchemas.getInsights,
  }),
  OrganizationController.getInsights
);
router.get(
  "/:id/favorite-folders",
  auth.requiredOrgMember,
  OrganizationController.getFavoriteFolderPaths
);
router.get(
  "/:id/rules",
  auth.requiredOrgMember,
  OrganizationController.getRulesForUser
);
router.get(
  "/:id/integrations",
  auth.requiredOrgMember,
  OrganizationController.getIntegrations
);
router.get(
  "/:id/connectable-integrations",
  auth.requiredOrgMember,
  OrganizationController.getConnectableIntegrations
);
router.get(
  "/:id/support-logs",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    querySchema: OrganizationSchemas.getSupportLogs,
  }),
  OrganizationController.getSupportLogs
);
router.get(
  "/:id/integration-oauth-link",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    querySchema: OrganizationSchemas.getIntegrationOAuthLink,
  }),
  OrganizationController.getIntegrationOAuthLink
);
router.get(
  "/:id/integration-logs",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    querySchema: OrganizationSchemas.getIntegrationLogs,
  }),
  OrganizationController.getIntegrationLogs
);

router.put(
  "/:id/user-permissions",
  auth.requiredOrgAdmin,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.updateUserPermissions,
  }),
  OrganizationController.updateUserPermissions
);
router.put(
  "/:id/folder",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.updateFolder,
  }),
  OrganizationController.updateFolder
);
router.put(
  "/:id/integration",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.updateIntegration,
  }),
  OrganizationController.updateIntegration
);

router.post(
  "/new",
  rateLimiterP1,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.createAccountAndOrganization,
  }),
  OrganizationController.createAccountAndOrganization
);
router.post(
  "/:id/user",
  rateLimiterP1,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.createNewUser,
  }),
  OrganizationController.createNewUser
);
router.post(
  "/:id/delete-folder",
  auth.requiredOrgAdmin,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.deleteFolderAndEverythingInside,
  }),
  OrganizationController.deleteFolderAndEverythingInside
);
router.post(
  "/:id/secret-key",
  auth.requiredOrgAdmin,
  OrganizationController.generateSecretKey
);
router.post(
  "/:id/folder",
  auth.requiredOrgAdmin,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.createNewEmptyFolder,
  }),
  OrganizationController.createNewEmptyFolder
);
router.post(
  "/:id/invite-link",
  auth.requiredOrgAdmin,
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
router.post(
  "/:id/funnel",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.createFunnel,
  }),
  OrganizationController.createFunnel
);
router.post(
  "/:id/favorite-folder",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.favoriteFolder,
  }),
  OrganizationController.favoriteFolder
);
router.post(
  "/:id/folder-preference",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.setFolderPreference,
  }),
  OrganizationController.setFolderPreference
);
router.post(
  "/:id/rule",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.createRule,
  }),
  OrganizationController.createRule
);
router.post(
  "/:id/delete-rule",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.deleteRule,
  }),
  OrganizationController.deleteRule
);
router.post(
  "/:id/user/phone/send-code",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.sendPhoneCode,
  }),
  OrganizationController.sendPhoneCode
);
router.post(
  "/:id/user/phone/verify-code",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.verifyPhoneCode,
  }),
  OrganizationController.verifyPhoneCode
);
router.post(
  "/:id/delete-log",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.deleteLog,
  }),
  OrganizationController.deleteLog
);
router.post(
  "/:id/integration",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.addOrUpdateIntegration,
  }),
  OrganizationController.addOrUpdateIntegration
);
router.post(
  "/:id/delete-integration",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.deleteIntegration,
  }),
  OrganizationController.deleteIntegration
);
router.post(
  "/:id/delete-funnel",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.deleteFunnel,
  }),
  OrganizationController.deleteFunnel
);
router.post(
  "/waitlist",
  rateLimiterP1,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.addToWaitlist,
  }),
  OrganizationController.addToWaitlist
);
router.post(
  "/:id/integration-oauth-finish",
  auth.requiredOrgMember,
  validateRequestAgainstSchemas({
    bodySchema: OrganizationSchemas.exchangeIntegrationOAuthToken,
  }),
  OrganizationController.exchangeIntegrationOAuthToken
);
export default router;
