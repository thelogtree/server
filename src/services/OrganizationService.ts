import {
  OrganizationDocument,
  UserDocument,
  orgPermissionLevel,
} from "logtree-types";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import { OrgInvitation } from "src/models/OrgInvitation";
import { Organization } from "src/models/Organization";
import { User } from "src/models/User";
import { config } from "src/utils/config";
import { ApiError, AuthError } from "src/utils/errors";
import { getHashFromPlainTextKey, wrapWords } from "src/utils/helpers";
import { uuid } from "uuidv4";
import firebase from "../../firebaseConfig";
import { Folder } from "src/models/Folder";
import { Log } from "src/models/Log";
import { ApiService } from "./ApiService/ApiService";
import { FolderService } from "./ApiService/lib/FolderService";
import { FavoriteFolder } from "src/models/FavoriteFolder";

export const OrganizationService = {
  createOrganization: async (
    name: string
  ): Promise<{
    organization: OrganizationDocument;
    firstInvitationUrl: string;
  }> => {
    const isExistingOrg = await Organization.exists({ name });
    if (isExistingOrg) {
      throw new ApiError("An organization with this name already exists.");
    }

    const publishableApiKey = uuid();
    const slug = wrapWords(name).toLowerCase();
    const organization = await Organization.create({
      name,
      slug,
      keys: {
        publishableApiKey,
      },
    });

    const firstInvitationUrl = await OrganizationService.generateInviteLink(
      organization._id as string,
      slug
    );

    await ApiService.createLog(
      organization!._id.toString(),
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
      organization._id.toString() === invitation.organizationId.toString();

    if (!invitationBelongsToOrg) {
      throw new ApiError("The invitation and organization do not match.");
    }

    const numMembers = await User.find({
      organizationId: organization._id,
    })
      .countDocuments()
      .exec();

    return {
      organizationName: organization.name,
      numMembers,
      organizationId: organization._id.toString(),
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
    await Log.deleteMany({ folderId: { $in: foldersIdsUnderTheOneToDelete } });
    await Folder.deleteMany({
      _id: { $in: foldersIdsUnderTheOneToDelete },
    });
  },
  getOrganizationMembers: (organizationId: string) =>
    User.find({ organizationId }).sort({ createdAt: 1 }).lean().exec(),
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
};
