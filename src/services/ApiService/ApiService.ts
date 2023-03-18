import { FolderService } from "./lib/FolderService";
import { LogService } from "./lib/LogService";

export const ApiService = {
  createLog: async (
    organizationId: string,
    folderPath: string,
    content: string
  ) => {
    FolderService.validateFolderPath(folderPath);
    const folderIdForThisLog =
      await FolderService.getOrGenerateLastFolderIdFromPath(
        organizationId,
        folderPath
      );
    return LogService.createLog(organizationId, folderIdForThisLog, content);
  },
};
