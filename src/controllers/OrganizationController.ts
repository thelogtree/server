import { Request, Response } from "express";
import {
  OrganizationDocument,
  UserDocument,
  integrationTypeEnum,
} from "logtree-types";
import { ObjectId } from "mongodb";
import { Folder } from "src/models/Folder";
import { FolderService } from "src/services/ApiService/lib/FolderService";
import { LogService } from "src/services/ApiService/lib/LogService";
import { OrganizationService } from "src/services/OrganizationService";
import { StatsService, timeIntervalEnum } from "src/services/StatsService";
import { ApiError, AuthError } from "src/utils/errors";
import { queryBool } from "src/utils/helpers";
import { Logger } from "src/utils/logger";
import moment from "moment-timezone";
import { RuleService } from "src/services/RuleService";
import { TwilioUtil } from "src/utils/twilio";
import { LoggerHelpers } from "src/utils/loggerHelpers";
import { SecureIntegrationService } from "src/services/integrations/SecureIntegrationService";
import _ from "lodash";

export const OrganizationController = {
  getMe: async (req: Request, res: Response) => {
    const user = req["user"];
    res.send(user);
  },
  getOrganization: async (req: Request, res: Response) => {
    const organization = req["organization"];
    res.send(organization);
  },
  getOrganizationMembers: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const users = await OrganizationService.getOrganizationMembers(
      organization._id
    );
    res.send({ users });
  },
  getFolders: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const user = req["user"];
    const folders = await FolderService.getFolders(organization._id, user._id);
    res.send({ folders });
  },
  getLogs: async (req: Request, res: Response) => {
    const user = req["user"];
    const organization = req["organization"];
    const {
      folderId,
      start,
      isFavorites,
      logsNoNewerThanDate,
      logsNoOlderThanDate,
    } = req.query;
    const backupDate = new Date();
    const isFavoritesBool = queryBool(isFavorites as string);
    if (!folderId && !isFavoritesBool) {
      throw new ApiError("Must provide either a folderId or isFavorites");
    }

    const [logs, numLogsInTotal] = await Promise.all([
      LogService.getLogs(
        folderId as string | undefined,
        isFavoritesBool ? user : undefined,
        Number(start || 0),
        undefined,
        (logsNoNewerThanDate as Date | undefined) || backupDate,
        logsNoOlderThanDate as Date | undefined
      ),
      LogService.getNumLogsInFolder(
        (logsNoNewerThanDate as Date | undefined) || backupDate,
        logsNoOlderThanDate as Date | undefined,
        folderId as string | undefined,
        isFavoritesBool ? user : undefined
      ),
      FolderService.recordUserCheckingFolder(
        user._id,
        folderId as string,
        isFavoritesBool
      ),
    ]);

    LoggerHelpers.recordCheckingChannel(
      user,
      organization,
      isFavoritesBool,
      folderId as string | undefined
    );

    res.send({ logs, numLogsInTotal });
  },
  searchForLogs: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const user = req["user"];
    const { folderId, isFavorites, query } = req.body;
    const isFavoritesBool = queryBool(isFavorites as string);
    const logs = await LogService.searchForLogs(
      organization._id,
      query as string,
      folderId as string | undefined,
      isFavoritesBool ? user : undefined
    );

    LoggerHelpers.recordSearch(
      organization,
      user,
      isFavoritesBool,
      query,
      folderId
    );

    res.send({ logs });
  },
  createOrganization: async (req: Request, res: Response) => {
    const { name } = req.body;
    const { organization, firstInvitationUrl } =
      await OrganizationService.createOrganization(name);
    res.send({ organization, firstInvitationUrl });
  },
  generateSecretKey: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const plaintextSecretKey = await OrganizationService.generateSecretKey(
      organization._id
    );
    res.send({ plaintextSecretKey });
  },
  generateInviteLink: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const url = await OrganizationService.generateInviteLink(
      organization._id as unknown as ObjectId,
      organization.slug
    );
    res.send({ url });
  },
  createNewUser: async (req: Request, res: Response) => {
    const organizationId = req.params.id;
    const { invitationId, email, password } = req.body;
    const user = await OrganizationService.createNewUser(
      organizationId,
      invitationId,
      email,
      password
    );

    LoggerHelpers.recordNewUserCreated(organizationId, email);

    res.send(user);
  },
  getInvitationInfo: async (req: Request, res: Response) => {
    const { invitationId, orgSlug } = req.query;
    const { organizationName, numMembers, organizationId } =
      await OrganizationService.getInvitationInfo(
        orgSlug as string,
        invitationId as string
      );
    res.send({ organizationName, numMembers, organizationId });
  },
  deleteFolderAndEverythingInside: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const user: UserDocument = req["user"];
    const { folderId } = req.body;

    LoggerHelpers.recordDeletedFolder(user, folderId, organization);

    await OrganizationService.deleteFolderAndEverythingInside(
      organization._id.toString(),
      folderId
    );

    res.send({});
  },
  updateUserPermissions: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const user: UserDocument = req["user"];
    const { newPermission, isRemoved, userIdToUpdate } = req.body;
    await OrganizationService.updateUserPermissions(
      organization._id.toString(),
      user._id.toString(),
      userIdToUpdate,
      newPermission,
      isRemoved
    );
    res.send({});
  },
  favoriteFolder: async (req: Request, res: Response) => {
    const user: UserDocument = req["user"];
    const organization: OrganizationDocument = req["organization"];
    const { fullPath, isRemoved } = req.body;
    await OrganizationService.favoriteFolder(
      user?._id.toString(),
      fullPath,
      isRemoved
    );

    Logger.sendLog(
      `User ${isRemoved ? "unfavorited" : "favorited"} a channel: ${fullPath}`,
      `/favorited-channel/${organization?.slug}`,
      user.email
    );

    res.send({});
  },
  getFavoriteFolderPaths: async (req: Request, res: Response) => {
    const user: UserDocument = req["user"];
    const folderPaths = await OrganizationService.getFavoriteFolderPaths(
      user?._id.toString()
    );
    res.send({ folderPaths });
  },
  setFolderPreference: async (req: Request, res: Response) => {
    const user: UserDocument = req["user"];
    const organization: OrganizationDocument = req["organization"];
    const { fullPath, isMuted } = req.body;
    await OrganizationService.setFolderPreference(
      user?._id.toString(),
      fullPath,
      isMuted
    );

    Logger.sendLog(
      `User ${isMuted ? "muted" : "unmuted"} a channel: ${fullPath}`,
      `/channel-preferences/${organization?.slug}`,
      user.email
    );

    res.send({});
  },
  getFolderStats: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { folderId, timezone } = req.query;
    const folder = await Folder.findById(folderId as string)
      .lean()
      .exec();
    if (folder.organizationId.toString() !== organization._id.toString()) {
      throw new AuthError(
        "Cannot get the folder stats of a folder in a different organization."
      );
    }
    const [relevantStatObj, logFrequencies, numLogsToday] = await Promise.all([
      StatsService.getRelevantStat(folderId as string),
      StatsService.getLogFrequenciesByInterval(
        folderId as string,
        timeIntervalEnum.Day,
        7
      ),
      StatsService.getNumLogsInTimePeriod(
        folderId as string,
        moment
          .tz(timezone as string)
          .startOf("day")
          .toDate(),
        moment
          .tz(timezone as string)
          .endOf("day")
          .toDate()
      ),
    ]);
    const { percentageChange, timeInterval } = relevantStatObj;
    res.send({
      percentageChange,
      timeInterval,
      logFrequencies: logFrequencies.length >= 2 ? logFrequencies : [],
      numLogsToday,
    });
  },
  updateFolder: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { folderId, description } = req.body;
    const folder = await FolderService.updateFolder(
      organization._id.toString(),
      folderId,
      description
    );
    res.send({ folder });
  },
  getInsights: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const user: UserDocument = req["user"];
    const { timezone } = req.query;
    const { insightsOfMostCheckedFolders, insightsOfNotMostCheckedFolders } =
      await StatsService.getInsights(
        organization._id.toString(),
        user._id.toString(),
        timezone as string
      );
    res.send({ insightsOfMostCheckedFolders, insightsOfNotMostCheckedFolders });
  },
  createRule: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const user: UserDocument = req["user"];
    const {
      folderId,
      comparisonType,
      comparisonValue,
      lookbackTimeInMins,
      notificationType,
    } = req.body;
    const rule = await RuleService.createRule(
      user._id.toString(),
      organization._id.toString(),
      folderId,
      comparisonType,
      comparisonValue,
      lookbackTimeInMins,
      notificationType
    );

    LoggerHelpers.recordNewRule(user, folderId, organization);

    res.send({ rule });
  },
  deleteRule: async (req: Request, res: Response) => {
    const user: UserDocument = req["user"];
    const organization: OrganizationDocument = req["organization"];
    const { ruleId } = req.body;
    await RuleService.deleteRule(user._id.toString(), ruleId);

    LoggerHelpers.recordDeletedRule(user, ruleId, organization);

    res.send({});
  },
  getRulesForUser: async (req: Request, res: Response) => {
    const user: UserDocument = req["user"];
    const rules = await RuleService.getRulesForUser(user._id.toString());
    res.send({ rules });
  },
  sendPhoneCode: async (req: Request, res: Response) => {
    const { phoneNumber } = req.body;
    await TwilioUtil.sendVerificationCode(phoneNumber);
    res.send({});
  },
  verifyPhoneCode: async (req: Request, res: Response) => {
    const user: UserDocument = req["user"];
    const { phoneNumber, code } = req.body;
    await TwilioUtil.submitVerificationCode(
      user._id.toString(),
      phoneNumber,
      code
    );
    res.send({});
  },
  addToWaitlist: async (req: Request, res: Response) => {
    const { email, websiteUrl, description } = req.body;
    await Logger.sendLog(
      `${email} joined the waitlist with ${websiteUrl}.\n\n${description}`,
      "/waitlist",
      email,
      websiteUrl
    );
    res.send({});
  },
  deleteLog: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { logId } = req.body;
    await LogService.deleteLog(logId, organization._id.toString());
    res.send({});
  },
  addOrUpdateIntegration: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { keys, type, additionalProperties } = req.body;
    if (!keys.length || keys.find((key) => !key.plaintextValue || !key.type)) {
      throw new ApiError(
        "Either no keys were provided, or the keys you provided were sent in an invalid format."
      );
    }
    const integration = await SecureIntegrationService.addOrUpdateIntegration(
      organization._id.toString(),
      type,
      keys,
      additionalProperties
    );
    res.send({ integration });
  },
  getIntegrations: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const integrations = await OrganizationService.getIntegrations(
      organization._id.toString()
    );
    res.send({ integrations });
  },
  deleteIntegration: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { integrationId } = req.body;
    await OrganizationService.deleteIntegration(
      organization._id.toString(),
      integrationId
    );
    res.send({});
  },
  updateIntegration: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { integrationId } = req.body;
    const integration = await OrganizationService.updateIntegration(
      organization._id.toString(),
      integrationId,
      _.omit(req.body, "integrationId")
    );
    res.send({ integration });
  },
  getConnectableIntegrations: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const integrations =
      await SecureIntegrationService.getConnectableIntegrationsForOrganization(
        organization._id.toString()
      );
    res.send({ integrations });
  },
  getSupportLogs: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const user = req["user"];
    const { query } = req.query;
    const logs = await LogService.getSupportLogs(organization, query as string);

    LoggerHelpers.recordSearch(
      organization,
      user,
      false,
      query as string,
      undefined,
      true
    );

    res.send({ logs });
  },
  exchangeIntegrationOAuthToken: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { sessionId, code } = req.body;

    await SecureIntegrationService.exchangeOAuthTokenAndConnect(
      organization._id.toString(),
      sessionId,
      code
    );

    res.send({});
  },
  getIntegrationOAuthLink: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { integrationType } = req.query;

    const url = await SecureIntegrationService.getOAuthLink(
      organization._id.toString(),
      integrationType as integrationTypeEnum
    );

    res.send({ url });
  },
};
