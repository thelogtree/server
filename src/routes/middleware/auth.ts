import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import { prop } from "lodash/fp";
import {
  OrganizationDocument,
  UserDocument,
  orgPermissionLevel,
} from "logtree-types";
import { Organization } from "src/models/Organization";
import { UsageService } from "src/services/ApiService/lib/UsageService";
import { AuthError, ErrorMessages } from "src/utils/errors";
import { MyLogtree } from "src/utils/logger";

const requiredOrgMember = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const { id } = req.params; // organization _id
  const organization = await Organization.findById(id).lean();
  const user = req["user"] as UserDocument | null;
  if (
    organization &&
    user?.organizationId.toString() === organization._id.toString()
  ) {
    req["organization"] = organization;
    return next();
  }
  throw new AuthError(ErrorMessages.NoPermission);
};

const requiredOrgAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const { id } = req.params; // organization _id
  const organization = await Organization.findById(id).lean();
  const user = req["user"] as UserDocument | null;
  if (
    organization &&
    user?.organizationId.toString() === organization._id.toString() &&
    user.orgPermissionLevel === orgPermissionLevel.Admin
  ) {
    req["organization"] = organization;
    return next();
  }
  throw new AuthError(ErrorMessages.NoPermission);
};

const requiredUser = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (req["user"]) {
    return next();
  }
  throw new AuthError(ErrorMessages.NoPermission);
};

const requiredAdminUser = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (prop("user.isAdmin", req)) {
    return next();
  }
  throw new AuthError(ErrorMessages.NoPermission);
};

const requiredApiKey = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const publishableApiKey = req.headers["x-logtree-key"]?.toString() || "";
  const plaintextSecretKey = req.headers["authorization"]?.toString() || "";
  const organization: OrganizationDocument | null = await Organization.findOne({
    "keys.publishableApiKey": publishableApiKey,
  })
    .lean()
    .exec();
  if (organization && organization.keys.encryptedSecretKey) {
    const isCorrect = await bcrypt.compare(
      plaintextSecretKey,
      organization.keys.encryptedSecretKey
    );

    const shouldAllowAnotherLog =
      UsageService.shouldAllowAnotherLog(organization);

    if (isCorrect && !organization.isSuspended && shouldAllowAnotherLog) {
      req["organization"] = organization;
      return next();
    } else if (isCorrect && shouldAllowAnotherLog && organization.isSuspended) {
      throw new AuthError(ErrorMessages.Suspended);
    } else if (
      isCorrect &&
      !shouldAllowAnotherLog &&
      !organization.isSuspended
    ) {
      throw new AuthError(ErrorMessages.ReachedLimit);
    }
  }
  void MyLogtree.sendLog({
    content: `api credentials incorrect?\napiKey: ${publishableApiKey}\norg: ${organization.name}`,
    folderPath: "/debugging",
    req,
  });
  throw new AuthError(ErrorMessages.ApiCredentialsIncorrect);
};

export default {
  requiredOrgMember,
  requiredOrgAdmin,
  requiredApiKey,
  requiredAdminUser,
  requiredUser,
};
