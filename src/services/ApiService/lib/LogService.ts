import { Log } from "src/models/Log";

export const LogService = {
  createLog: (organizationId: string, folderId: string, content: string) => {
    const MAX_NUM_CHARS_ALLOWED = 1000;
    let editedContent = content;
    if (content.length > MAX_NUM_CHARS_ALLOWED) {
      editedContent = content.substring(0, MAX_NUM_CHARS_ALLOWED);
    }

    return Log.create({
      content: editedContent,
      organizationId,
      folderId,
    });
  },
};
