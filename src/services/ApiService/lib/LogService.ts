import { Log } from "src/models/Log";

export const MAX_NUM_CHARS_ALLOWED_IN_LOG = 1000;

export const LogService = {
  createLog: (organizationId: string, folderId: string, content: string) => {
    let editedContent = content;
    if (content.length > MAX_NUM_CHARS_ALLOWED_IN_LOG) {
      editedContent =
        content.substring(0, MAX_NUM_CHARS_ALLOWED_IN_LOG) + "...";
    }

    return Log.create({
      content: editedContent,
      organizationId,
      folderId,
    });
  },
};
