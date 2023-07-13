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
import { isWebhookRequestFromIntercom, queryBool } from "src/utils/helpers";
import { MyLogtree } from "src/utils/logger";
import moment from "moment-timezone";
import { RuleService } from "src/services/RuleService";
import { TwilioUtil } from "src/utils/twilio";
import { SecureIntegrationService } from "src/services/integrations/SecureIntegrationService";
import _ from "lodash";
import { WidgetService } from "src/services/WidgetService";
import { SegmentEventsEnum, SegmentUtil } from "src/utils/segment";
import { IntercomService } from "src/services/integrations";
import { User } from "src/models/User";
import { quickGptEnum } from "logtree-types/misc";

export const OrganizationController = {
  createAccountAndOrganization: async (req: Request, res: Response) => {
    const { organizationName, email, password, promoCode } = req.body;

    await OrganizationService.createAccountAndOrganization(
      organizationName,
      email,
      password,
      promoCode
    );

    void MyLogtree.sendLog({
      content: `Created organization with name "${organizationName}" and account with email "${email}"`,
      folderPath: "/new-organizations",
    });

    res.send({});
  },
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
    const folders = await FolderService.getFolders(organization._id, user);
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

    res.send({ logs });
  },
  createFunnel: async (req: Request, res: Response) => {
    const user = req["user"];
    const organization = req["organization"];
    const { folderPathsInOrder, forwardToChannelPath } = req.body;

    const funnel = await OrganizationService.createFunnel(
      organization._id,
      folderPathsInOrder,
      forwardToChannelPath
    );

    res.send({ funnel });
  },
  deleteFunnel: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const { funnelId } = req.body;

    await OrganizationService.deleteFunnel(
      organization._id.toString(),
      funnelId
    );

    res.send({});
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

    SegmentUtil.track(SegmentEventsEnum.InviteAccepted, user.firebaseId, {
      invitationId,
      email,
      organizationId,
    });

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

    MyLogtree.sendLog({
      content: `User ${
        isRemoved ? "unfavorited" : "favorited"
      } a channel: ${fullPath}`,
      folderPath: `/favorited-channel/${organization?.slug}`,
      referenceId: user.email,
    });

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

    MyLogtree.sendLog({
      content: `User ${isMuted ? "muted" : "unmuted"} a channel: ${fullPath}`,
      folderPath: `/channel-preferences/${organization?.slug}`,
      referenceId: user.email,
    });

    res.send({});
  },
  getFolderStats: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { folderId, timezone, isHistogramByReferenceId, lastXDays } =
      req.query;
    const lastXDaysNumber = Number((lastXDays as string) || 1);
    const folder = await Folder.findById(folderId as string)
      .lean()
      .exec();
    if (folder.organizationId.toString() !== organization._id.toString()) {
      throw new AuthError(
        "Cannot get the folder stats of a folder in a different organization."
      );
    }
    const [relevantStatObj, logFrequencies, numLogsToday, histogramsObj] =
      await Promise.all([
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
        StatsService.getHistogramsForFolder(
          folderId as string,
          queryBool(isHistogramByReferenceId as string),
          isNaN(lastXDaysNumber) ? 1 : lastXDaysNumber
        ),
      ]);
    const { percentageChange, timeInterval } = relevantStatObj;
    const { histograms, moreHistogramsAreNotShown } = histogramsObj;
    res.send({
      percentageChange,
      timeInterval,
      logFrequencies: logFrequencies.length >= 2 ? logFrequencies : [],
      numLogsToday,
      histograms,
      moreHistogramsAreNotShown,
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

    res.send({ rule });
  },
  deleteRule: async (req: Request, res: Response) => {
    const user: UserDocument = req["user"];
    const organization: OrganizationDocument = req["organization"];
    const { ruleId } = req.body;
    await RuleService.deleteRule(user, ruleId, organization, req);

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
    await MyLogtree.sendLog({
      content: `${email} joined the waitlist with ${websiteUrl}.\n\n${description}`,
      folderPath: "/waitlist",
      referenceId: email,
      externalLink: websiteUrl,
    });
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
  getFunnels: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const funnels = await OrganizationService.getFunnels(
      organization._id.toString()
    );
    res.send({ funnels });
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
    const query = (req.query.query as string).trim();
    const logs = await LogService.getSupportLogs(organization, query as string);

    SegmentUtil.track(SegmentEventsEnum.Searched, user.firebaseId, {
      numLogs: logs.length,
      query,
      organization: organization.slug,
      user_email: user.email,
    });

    res.send({ logs });
  },
  getIntegrationLogs: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { integrationId, query } = req.query;
    const trimmedQuery = query ? (query as string).trim() : undefined;
    const logs = await LogService.getIntegrationLogs(
      organization,
      integrationId as string,
      trimmedQuery as string | undefined
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
  createNewEmptyFolder: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { folderPath } = req.body;

    FolderService.validateFolderPath(folderPath);
    await FolderService.getOrGenerateLastFolderIdFromPath(
      organization._id.toString(),
      folderPath
    );

    res.send({});
  },
  createWidget: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const {
      dashboardId,
      title,
      type,
      folderPaths,
      query,
      position,
      size,
      timeframe,
      url,
    } = req.body;

    const widget = await WidgetService.createWidget(
      organization._id.toString(),
      dashboardId,
      title,
      type,
      folderPaths,
      position,
      size,
      query,
      timeframe || undefined,
      url || undefined
    );

    res.send({ widget });
  },
  createDashboard: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { title } = req.body;

    const dashboard = await OrganizationService.createDashboard(
      organization._id.toString(),
      title
    );

    res.send({ dashboard });
  },
  deleteDashboard: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { dashboardId } = req.body;

    await OrganizationService.deleteDashboard(
      organization._id.toString(),
      dashboardId
    );

    res.send({});
  },
  deleteWidget: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { widgetId } = req.body;

    await WidgetService.deleteWidget(organization._id.toString(), widgetId);

    res.send({});
  },
  updateWidget: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { widgetId, position, size, title } = req.body;

    const widget = await WidgetService.updateWidget(
      organization._id.toString(),
      widgetId,
      position,
      size,
      title
    );

    res.send({ widget });
  },
  getWidgets: async (req: Request, res: Response) => {
    const user: UserDocument = req["user"];
    const organization: OrganizationDocument = req["organization"];
    const { dashboardId } = req.query;

    const widgets = await WidgetService.getWidgets(
      organization._id.toString(),
      dashboardId!.toString()
    );

    void MyLogtree.sendLog({
      content: `Fetched widgets (${organization.slug})`,
      folderPath: "/fetched-widgets",
      referenceId: user.email,
      additionalContext: {
        widgets: JSON.stringify(widgets.map((w) => w.title)),
      },
    });

    res.send({ widgets });
  },
  loadWidget: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { widgetId } = req.query;

    const data = await WidgetService.loadWidget(
      organization._id.toString(),
      widgetId!.toString()
    );

    res.send({ data });
  },
  getDashboards: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];

    const dashboards = await OrganizationService.getDashboards(
      organization._id.toString()
    );

    res.send({ dashboards });
  },
  quickGpt: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { email } = req.body;
    const type: quickGptEnum = req.body.type;

    let response = "";
    switch (type) {
      case quickGptEnum.Diagnose:
        response = await OrganizationService.diagnoseProblem(
          organization,
          email
        );
    }

    res.send({ response });
  },
  getIntercomCanvas: async (req: Request, res: Response) => {
    const signature = req.headers["x-body-signature"];
    if (!isWebhookRequestFromIntercom(signature?.toString() || "", req.body)) {
      throw new AuthError(
        "Could not verify that this request is from Intercom."
      );
    }

    const { workspace_id, contact } = req.body;
    const { email } = contact;

    const canvas = await IntercomService.getEventTimelineForIntercom(
      workspace_id,
      email
    );

    res.send(canvas);
  },
  recordIntercomCanvasInteraction: async (req: Request, res: Response) => {
    const signature = req.headers["x-body-signature"];
    if (!isWebhookRequestFromIntercom(signature?.toString() || "", req.body)) {
      throw new AuthError(
        "Could not verify that this request is from Intercom."
      );
    }

    const email = req.body.admin.email;
    const contactEmail = req.body.contact.email;
    const user = await User.findOne({ email }).lean();
    if (user) {
      SegmentUtil.track(
        SegmentEventsEnum.InteractionWithIntercomCanvas,
        user.firebaseId,
        {
          user_email: email,
          customer_email: contactEmail,
        }
      );
    }

    res.send({});
  },
};
