import { ObjectId } from "mongodb";
import { Document, Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";

const TeamSchema = new Schema(
  {
    id: {
      type: String,
      default: null,
    },
    name: {
      type: String,
    },
  },
  {
    strict: false,
    _id: false,
  }
);

const EnterpriseSchema = new Schema(
  {
    id: {
      type: String,
      default: null,
    },
    name: {
      type: String,
    },
  },
  {
    strict: false,
    _id: false,
  }
);

const BotSchema = new Schema(
  {
    token: {
      type: String,
    },
  },
  {
    strict: false,
    _id: false,
  }
);

const SlackInstallationSchema = new Schema(
  {
    team: { type: TeamSchema },
    enterprise: { type: EnterpriseSchema },
    bot: { type: BotSchema },
    isEnterpriseInstall: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

SlackInstallationSchema.index({ folderId: 1 });
SlackInstallationSchema.index({ "team.id": 1, createdAt: 1 });
SlackInstallationSchema.index({
  "team.id": 1,
  isEnterpriseInstall: 1,
  createdAt: 1,
});
SlackInstallationSchema.index({
  "enterprise.id": 1,
  isEnterpriseInstall: 1,
  createdAt: 1,
});

export interface SlackInstallationDocument extends Document {
  team: {
    id: string | null;
    name?: string;
  };
  enterprise?: {
    id: string | null;
    name?: string;
  };
  bot: {
    token: string;
  };
  isEnterpriseInstall: boolean;
}

interface SlackInstallationModel extends Model<SlackInstallationDocument> {}

export const SlackInstallation = model<
  SlackInstallationDocument,
  SlackInstallationModel
>("SlackInstallation", SlackInstallationSchema);
