import { OrganizationDocument } from "logtree-types";
import { FolderService } from "./lib/FolderService";
import { LogService } from "./lib/LogService";
import { PricingService } from "./lib/PricingService";
import { Folder } from "src/models/Folder";

export const ApiService = {
  createLog: async (
    organization: OrganizationDocument,
    folderPath: string,
    content: string,
    shouldCharge: boolean = false
  ) => {
    FolderService.validateFolderPath(folderPath);
    const folderIdForThisLog =
      await FolderService.getOrGenerateLastFolderIdFromPath(
        organization._id.toString(),
        folderPath
      );
    const log = await LogService.createLog(
      organization._id.toString(),
      folderIdForThisLog,
      content
    );
    void Folder.updateOne(
      { _id: folderIdForThisLog },
      { dateOfMostRecentLog: new Date() }
    );
    if (shouldCharge) {
      void PricingService.chargeForLog(organization);
    }
    return log;
  },
};
