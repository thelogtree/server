import Joi from "joi";
import { objectId } from "src/utils/joiFieldValidators";

export const OrganizationSchemas = {
  createAccountAndOrganization: Joi.object({
    organizationName: Joi.string().required(),
    email: Joi.string().required(),
    password: Joi.string().min(6).required(),
    promoCode: Joi.string().allow(""),
  }),
  createOrganization: Joi.object({
    name: Joi.string().required(),
  }),
  getLogs: Joi.object({
    folderId: Joi.string().custom(objectId),
    isFavorites: Joi.boolean(),
    start: Joi.number(),
    logsNoNewerThanDate: Joi.date(),
    logsNoOlderThanDate: Joi.date(),
  }),
  getSupportLogs: Joi.object({
    query: Joi.string().required(),
  }),
  getInvitationInfo: Joi.object({
    invitationId: Joi.string().custom(objectId).required(),
    orgSlug: Joi.string().required(),
  }),
  searchForLogs: Joi.object({
    folderId: Joi.string().custom(objectId),
    isFavorites: Joi.boolean(),
    query: Joi.string().required(),
  }),
  createNewUser: Joi.object({
    invitationId: Joi.string().custom(objectId).required(),
    email: Joi.string().required(),
    password: Joi.string().required(),
  }),
  deleteFolderAndEverythingInside: Joi.object({
    folderId: Joi.string().custom(objectId).required(),
  }),
  updateUserPermissions: Joi.object({
    userIdToUpdate: Joi.string().custom(objectId).required(),
    newPermission: Joi.string(),
    isRemoved: Joi.boolean(),
  }),
  favoriteFolder: Joi.object({
    fullPath: Joi.string().required(),
    isRemoved: Joi.boolean(),
  }),
  setFolderPreference: Joi.object({
    fullPath: Joi.string().required(),
    isMuted: Joi.boolean(),
  }),
  getFolderStats: Joi.object({
    folderId: Joi.string().custom(objectId).required(),
    timezone: Joi.string().required(),
    isHistogramByReferenceId: Joi.any(),
    lastXDays: Joi.any(),
  }),
  updateFolder: Joi.object({
    folderId: Joi.string().custom(objectId).required(),
    description: Joi.string().allow("").optional().max(400),
  }),
  getInsights: Joi.object({
    timezone: Joi.string().required(),
  }),
  createRule: Joi.object({
    folderId: Joi.string().custom(objectId).required(),
    comparisonType: Joi.string().required(),
    comparisonValue: Joi.number().required().min(0),
    lookbackTimeInMins: Joi.number().required().min(20),
    notificationType: Joi.string().required(),
  }),
  deleteRule: Joi.object({
    ruleId: Joi.string().custom(objectId).required(),
  }),
  sendPhoneCode: Joi.object({
    phoneNumber: Joi.string().required(),
  }),
  verifyPhoneCode: Joi.object({
    phoneNumber: Joi.string().required(),
    code: Joi.string().required(),
  }),
  addToWaitlist: Joi.object({
    email: Joi.string().required(),
    websiteUrl: Joi.string().required(),
    description: Joi.string().required(),
  }),
  deleteLog: Joi.object({
    logId: Joi.string().custom(objectId).required(),
  }),
  addOrUpdateIntegration: Joi.object({
    keys: Joi.array().required(),
    type: Joi.string().required(),
    additionalProperties: Joi.object(),
  }),
  deleteIntegration: Joi.object({
    integrationId: Joi.string().custom(objectId).required(),
  }),
  updateIntegration: Joi.object({
    integrationId: Joi.string().custom(objectId).required(),
    additionalProperties: Joi.object(),
  }),
  exchangeIntegrationOAuthToken: Joi.object({
    sessionId: Joi.string().custom(objectId).required(),
    code: Joi.string().required(),
  }),
  getIntegrationOAuthLink: Joi.object({
    integrationType: Joi.string().required(),
  }),
  getIntegrationLogs: Joi.object({
    integrationId: Joi.string().custom(objectId).required(),
    query: Joi.string().allow(""),
  }),
  createNewEmptyFolder: Joi.object({
    folderPath: Joi.string().required(),
  }),
  createFunnel: Joi.object({
    folderPathsInOrder: Joi.array().required(),
    forwardToChannelPath: Joi.string().required(),
  }),
  deleteFunnel: Joi.object({
    funnelId: Joi.string().custom(objectId).required(),
  }),
  createWidget: Joi.object({
    dashboardId: Joi.string().custom(objectId).required(),
    title: Joi.string().required(),
    type: Joi.string().required(),
    folderPaths: Joi.array().required(),
    query: Joi.string().optional().allow(""),
    position: Joi.any(),
    size: Joi.any(),
  }),
  createDashboard: Joi.object({
    title: Joi.string().required(),
  }),
  deleteDashboard: Joi.object({
    dashboardId: Joi.string().custom(objectId).required(),
  }),
  deleteWidget: Joi.object({
    widgetId: Joi.string().custom(objectId).required(),
  }),
};
