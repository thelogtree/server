import { OpenAI } from "langchain/llms/openai";
import { loadSummarizationChain } from "langchain/chains";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Log } from "src/models/Log";
import { Folder } from "src/models/Folder";
import { ApiError, AuthError } from "./errors";
import { MyLogtree } from "./logger";

export const PROMPT_CHANNEL_ENDING = "-prompts";

export const LangchainUtil = {
  askQuestionToFolder: async (
    question: string,
    folderId: string,
    organizationIdMakingRequest: string
  ) => {
    const folderBelongsToOrganization = await Folder.findOne({
      _id: folderId,
      organizationId: organizationIdMakingRequest,
    });
    if (!folderBelongsToOrganization) {
      throw new AuthError("This folder does not belong to your organization.");
    }

    if (
      !folderBelongsToOrganization.fullPath.includes(PROMPT_CHANNEL_ENDING) ||
      folderBelongsToOrganization.fullPath.length ===
        folderBelongsToOrganization.fullPath.indexOf(PROMPT_CHANNEL_ENDING) +
          PROMPT_CHANNEL_ENDING.length
    ) {
      throw new ApiError("Q/A support is only enabled for prompts right now.");
    }

    if (question.length > 600) {
      throw new ApiError("Your question is too long.");
    }

    const logsFromFolder = await Log.find(
      {
        folderId,
      },
      { content: 1, _id: 0 }
    )
      .lean()
      .exec();

    if (!logsFromFolder.length) {
      return "Your question cannot be answered because there are no logs in this channel yet.";
    }

    let text = "";
    logsFromFolder.forEach((log) => {
      if (text) {
        text += "\n------\n";
      }
      text += log.content;
    });

    const model = new OpenAI({ temperature: 0, modelName: "gpt-3.5-turbo" });
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
    });
    const docs = await textSplitter.createDocuments([text]);

    // This convenience function creates a document chain prompted to summarize a set of documents.
    const chain = loadSummarizationChain(model, { type: "map_reduce" });
    const res = await chain.call({
      input_documents: docs,
      question,
    });

    const textResponse = res.text as string;

    void MyLogtree.sendLog({
      content: question,
      folderPath: "/question-prompts",
      additionalContext: {
        folderId,
        organizationIdMakingRequest,
        response: textResponse,
      },
    });

    return textResponse;
  },
};
