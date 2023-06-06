import {
  IntegrationDocument,
  OrganizationDocument,
  orgPermissionLevel,
  UserDocument,
} from "logtree-types";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import { FavoriteFolder } from "src/models/FavoriteFolder";
import { Folder } from "src/models/Folder";
import { FolderPreference } from "src/models/FolderPreference";
import { Integration } from "src/models/Integration";
import { Log } from "src/models/Log";
import { Organization } from "src/models/Organization";
import { OrgInvitation } from "src/models/OrgInvitation";
import { Rule } from "src/models/Rule";
import { User } from "src/models/User";
import { config } from "src/utils/config";
import { ApiError, AuthError } from "src/utils/errors";
import {
  getHashFromPlainTextKey,
  numberToNumberWithCommas,
  wrapWords,
} from "src/utils/helpers";
import { uuid } from "uuidv4";

import firebase from "../../firebaseConfig";
import { ApiService } from "./ApiService/ApiService";
import { FolderService } from "./ApiService/lib/FolderService";
import { UsageService } from "./ApiService/lib/UsageService";
import { SecureIntegrationService } from "src/services/integrations/index";
import { SendgridUtil } from "src/utils/sendgrid";
import { AvailablePromoCodes } from "src/utils/promoCodes";
import { MyLogtree } from "src/utils/logger";
import { Funnel } from "src/models/Funnel";

export const TRIAL_LOG_LIMIT = 20000;

export const OrganizationService = {
  createAccountAndOrganization: async (
    organizationName: string,
    email: string,
    password: string,
    promoCode?: string
  ) => {
    const existingUser = await User.exists({ email });
    if (existingUser) {
      throw new ApiError("An account with this email already exists.");
    }

    const lowercasePromoCode = promoCode?.toLowerCase();
    const promoLogLimit = AvailablePromoCodes[lowercasePromoCode || ""];
    if (lowercasePromoCode && !promoLogLimit) {
      throw new ApiError(`The promo code ${promoCode} is not valid.`);
    }

    const { organization } = await OrganizationService.createOrganization(
      organizationName,
      promoLogLimit
    );
    const invitation = await OrgInvitation.findOne({
      organizationId: organization._id,
    })
      .lean()
      .exec();
    await OrganizationService.createNewUser(
      organization._id.toString(),
      invitation._id.toString(),
      email,
      password
    );

    if (promoCode && promoLogLimit) {
      void MyLogtree.sendLog({
        content: `Applied promo code ${promoCode} to get ${promoLogLimit} free logs per month.`,
        folderPath: "/promo-codes",
        additionalContext: {
          organizationName: organizationName,
        },
        referenceId: email,
      });
    }

    try {
      await SendgridUtil.sendEmail({
        to: email,
        subject: "Welcome to Logtree 🎉",
        text: "",
        html: `<p>Hey!</p><p>We've already set up your account with ${numberToNumberWithCommas(
          TRIAL_LOG_LIMIT
        )} free logs per month and unlimited connections to integrations. You can email us at hello@logtree.co if you want to increase this limit. Also feel free to reach out if you have any questions or requests!</p>`,
      });
    } catch {}
  },
  createOrganization: async (
    name: string,
    overrideLogLimit?: number
  ): Promise<{
    organization: OrganizationDocument;
    firstInvitationUrl: string;
  }> => {
    const slug = wrapWords(name).toLowerCase();
    const isExistingOrg = await Organization.exists({ slug });
    if (isExistingOrg) {
      throw new ApiError("An organization with this name already exists.");
    }

    const publishableApiKey = uuid();
    const { cycleStarts, cycleEnds } = UsageService.getPeriodDates();
    const organization = await Organization.create({
      name,
      slug,
      keys: {
        publishableApiKey,
      },
      logLimitForPeriod: overrideLogLimit || TRIAL_LOG_LIMIT,
      cycleStarts,
      cycleEnds,
    });

    const firstInvitationUrl = await OrganizationService.generateInviteLink(
      organization._id as string,
      slug
    );

    await ApiService.createLog(
      organization,
      "/get-started",
      "This is what a log looks like...head over to the API Dashboard to send your own logs!"
    );

    return { organization, firstInvitationUrl };
  },
  generateSecretKey: async (organizationId: ObjectId) => {
    const plaintextSecretKey = uuid();
    const encryptedSecretKey = await getHashFromPlainTextKey(
      plaintextSecretKey,
      config.encryption.saltRounds
    );
    await Organization.updateOne(
      { _id: organizationId },
      {
        "keys.encryptedSecretKey": encryptedSecretKey,
      }
    ).exec();
    return plaintextSecretKey;
  },
  generateInviteLink: async (
    organizationId: string | ObjectId,
    organizationSlug: string
  ) => {
    // expires in 24 hours or when it gets used
    const invite = await OrgInvitation.create({
      organizationId: organizationId,
      expiresAt: DateTime.now().plus({ days: 1 }),
      isOneTimeUse: true,
    });

    return `${
      config.baseUrl
    }/invite/${organizationSlug}/${invite._id.toString()}`;
  },
  createFunnel: async (
    organizationId: string | ObjectId,
    folderPathsInOrder: string[],
    forwardToChannelPath: string
  ) => {
    FolderService.validateFolderPath(forwardToChannelPath);

    for (const folderPath of folderPathsInOrder) {
      try {
        FolderService.validateFolderPath(folderPath);
      } catch (e) {
        throw new Error(`The folder path of ${folderPath} is invalid.`);
      }
    }

    return Funnel.create({
      organizationId,
      folderPathsInOrder,
      forwardToChannelPath,
    });
  },
  deleteFunnel: async (organizationId: string, funnelId: string) => {
    const funnelExists = await Funnel.exists({ _id: funnelId, organizationId });

    if (!funnelExists) {
      throw new ApiError(
        "No funnel with this ID exists for this organization."
      );
    }

    await Funnel.deleteOne({ _id: funnelId });
  },
  createNewUser: async (
    organizationId: string | ObjectId,
    invitationId: string | ObjectId,
    email: string,
    password: string
  ): Promise<UserDocument> => {
    const invitation = await OrgInvitation.findOne({
      _id: invitationId,
      organizationId,
      expiresAt: { $gt: new Date() },
    })
      .lean()
      .exec();
    if (!invitation) {
      throw new ApiError(
        "This invite has expired. Please ask a team member for a new invite link."
      );
    }

    if (invitation.isOneTimeUse) {
      const wasInvitationAlreadyUsed = await User.exists({
        invitationId: invitation._id,
        organizationId,
      })
        .lean()
        .exec();
      if (wasInvitationAlreadyUsed) {
        throw new ApiError(
          "This invite has already been used. Please ask a team member for a new invite link."
        );
      }
    }

    const userWithEmailAlreadyExists = await User.exists({ email })
      .lean()
      .exec();
    if (userWithEmailAlreadyExists) {
      throw new ApiError(
        "You already have an account under this email. Please contact support."
      );
    }

    const isAtLeastOneUserInOrg = await User.exists({ organizationId })
      .lean()
      .exec();

    const firebaseUser = await firebase.auth().createUser({
      email,
      password,
    });
    return User.create({
      organizationId,
      email,
      firebaseId: firebaseUser.uid,
      invitationId: invitation._id,
      orgPermissionLevel: isAtLeastOneUserInOrg
        ? orgPermissionLevel.Member
        : orgPermissionLevel.Admin,
    });
  },
  getInvitationInfo: async (orgSlug: string, invitationId: string) => {
    const invitation = await OrgInvitation.findById(invitationId).lean().exec();
    const organization = await Organization.findOne({
      slug: orgSlug,
    })
      .lean()
      .exec();
    const invitationBelongsToOrg =
      organization?._id?.toString() === invitation?.organizationId?.toString();

    if (!invitationBelongsToOrg || !invitationId) {
      throw new ApiError("The invitation and organization do not match.");
    }

    const numMembers = await User.countDocuments({
      organizationId: organization?._id,
    }).exec();

    return {
      organizationName: organization?.name,
      numMembers,
      organizationId: organization?._id.toString(),
    };
  },
  deleteFolderAndEverythingInside: async (
    organizationId: string,
    folderId: string
  ) => {
    const folderWithinTheOrg = await Folder.findOne({
      _id: folderId,
      organizationId,
    })
      .lean()
      .exec();
    if (!folderWithinTheOrg) {
      throw new AuthError("You cannot delete this folder.");
    }

    const allFolders = await Folder.find({ organizationId }).lean().exec();
    let foldersIdsUnderTheOneToDelete = allFolders
      .filter((folder) => {
        const indexOfPath = folder.fullPath.indexOf(
          folderWithinTheOrg.fullPath
        );
        return indexOfPath === 0;
      })
      .map((folder) => folder._id);

    await Promise.all([
      Log.deleteMany({ folderId: { $in: foldersIdsUnderTheOneToDelete } }),
      Folder.deleteMany({
        _id: { $in: foldersIdsUnderTheOneToDelete },
      }),
      Rule.deleteMany({ folderId: { $in: foldersIdsUnderTheOneToDelete } }),
    ]);
  },
  getOrganizationMembers: (organizationId: string) =>
    User.find(
      { organizationId },
      {
        email: 1,
        _id: 1,
        organizationId: 1,
        isAdmin: 1,
        orgPermissionLevel: 1,
      }
    )
      .sort({ createdAt: 1 })
      .lean()
      .exec(),
  updateUserPermissions: async (
    organizationId: string,
    userIdMakingRequest: string,
    userIdToUpdate: string,
    newPermission?: orgPermissionLevel,
    isRemoved?: boolean
  ) => {
    if (userIdMakingRequest === userIdToUpdate) {
      throw new ApiError("You cannot update your own permissions.");
    }
    const userToUpdate = await User.findById(userIdToUpdate).lean().exec();
    if (userToUpdate?.organizationId.toString() !== organizationId) {
      throw new ApiError(
        "You cannot update the permissions of a user outside your organization."
      );
    }
    if (isRemoved) {
      await firebase.auth().deleteUser(userToUpdate.firebaseId);
      await User.deleteOne({ _id: userIdToUpdate });
    } else if (newPermission) {
      await User.updateOne(
        { _id: userIdToUpdate },
        { orgPermissionLevel: newPermission }
      );
    }
  },
  favoriteFolder: async (
    userId: string,
    fullPath: string,
    isRemoved?: boolean
  ) => {
    FolderService.validateFolderPath(fullPath);

    const favoritedFolderExists = await FavoriteFolder.exists({
      fullPath,
      userId,
    });

    if (!favoritedFolderExists && isRemoved) {
      throw new ApiError(
        "Cannot unfavorite a folder that is not currently favorited."
      );
    } else if (isRemoved) {
      return FavoriteFolder.deleteOne({ fullPath, userId });
    } else if (favoritedFolderExists) {
      throw new ApiError("Cannot favorite a folder that is already favorited.");
    }

    return FavoriteFolder.create({
      fullPath,
      userId,
    });
  },
  getFavoriteFolderPaths: async (userId: string): Promise<string[]> => {
    const favoriteFolders = await FavoriteFolder.find(
      { userId },
      { fullPath: 1, _id: 0 }
    )
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return favoriteFolders.map((f) => f.fullPath);
  },
  setFolderPreference: async (
    userId: string,
    fullPath: string,
    isMuted?: boolean
  ) =>
    FolderPreference.updateOne(
      { userId, fullPath },
      { isMuted },
      { upsert: true }
    ).exec(),
  getIntegrations: async (organizationId: string) =>
    Integration.find({
      organizationId,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec(),
  deleteIntegration: async (organizationId: string, integrationId: string) => {
    const integration = await Integration.findOne({
      _id: integrationId,
      organizationId,
    }).exec();
    if (!integration) {
      throw new ApiError("Could not find that integration.");
    }

    // does nothing if there is no oauth connection to remove for this integr
    await SecureIntegrationService.removeAnyOAuthConnectionIfApplicable(
      integration
    );

    await Integration.deleteOne({ _id: integrationId });
  },
  updateIntegration: async (
    organizationId: string,
    integrationId: string,
    fields: Partial<IntegrationDocument>
  ) => {
    const integration = await Integration.exists({
      _id: integrationId,
      organizationId,
    }).exec();
    if (!integration) {
      throw new ApiError("Could not find an integration to update.");
    }

    return Integration.findByIdAndUpdate(integrationId, fields, { new: true });
  },
};
