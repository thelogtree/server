import { OrganizationDocument, UserDocument } from "logtree-types";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import { OrgInvitation } from "src/models/OrgInvitation";
import { Organization } from "src/models/Organization";
import { User } from "src/models/User";
import { config } from "src/utils/config";
import { ApiError } from "src/utils/errors";
import { getHashFromPlainTextKey, wrapWords } from "src/utils/helpers";
import { uuid } from "uuidv4";
import firebase from "../../firebaseConfig";

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
    const slug = wrapWords(name);
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
    }/${organizationSlug}/invite/${invite._id.toString()}`;
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

    const firebaseUser = await firebase.auth().createUser({
      email,
      password,
    });
    return User.create({
      organizationId,
      email,
      firebaseId: firebaseUser.uid,
      invitationId: invitation._id,
    });
  },
};
