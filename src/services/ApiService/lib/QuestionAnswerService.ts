import { OrganizationDocument, UserDocument } from "logtree-types";
import { Integration } from "src/models/Integration";
import { SecureIntegrationService } from "src/services/integrations/SecureIntegrationService";
import { ApiError } from "src/utils/errors";
import { Configuration, OpenAIApi } from "openai";
import { config } from "src/utils/config";
import { Logger } from "src/utils/logger";
import { values } from "lodash";

const configuration = new Configuration({
  apiKey: config.openai.apiKey,
});
const OpenAI = new OpenAIApi(configuration);

const _arrayToMarkdown = (array: any[]) => {
  // Extract the keys from the first object
  const keys = Object.keys(array[0]);

  // Create the header row
  const headerRow = `|${keys.join("|")}|\n`;

  // Create the separator row
  let separatorRow = "|";
  keys.forEach(() => {
    separatorRow += "----|";
  });
  separatorRow += `\n`;

  // Create the data rows
  let fullDataStr = "";
  array.forEach((obj) => {
    let str = "|";
    const values = Object.values(obj);
    values.forEach((value) => {
      str += `${value}|`;
    });
    str += "\n";

    fullDataStr += str;
  });

  // Join all the rows
  const markdownString = `${headerRow}${separatorRow}${fullDataStr}`;

  return markdownString;
};

export const QuestionAnswerService = {
  askQuestion: async (
    user: UserDocument,
    organization: OrganizationDocument,
    integrationId: string,
    question: string
  ) => {
    if (question.length > 750) {
      throw new ApiError(
        "Your question is too long. Please make sure it is no longer than 750 characters."
      );
    }

    const integration = await Integration.findOne({
      _id: integrationId,
      organizationId: organization._id,
    }).exec();
    if (!integration) {
      throw new ApiError("This integration could not be found.");
    }

    const getLogsFxn =
      SecureIntegrationService.getCorrectQuestionAnswerLogsFunctionToRun(
        integration
      );
    const logsFromIntegration = await getLogsFxn!(integration);

    const promptPrefix = `You are an analyst assistant bot called "Logtree AI". Your job is to help an analyst answer their question about a bunch of events from a specific source which could be storing marketing data, technical data, sales data, communications data, or anything else. I am giving you all of the events from the source they have a question about which is called ${integration.type}:\n\n`;
    const promptDataInput = _arrayToMarkdown(logsFromIntegration).slice(
      0,
      7000
    );
    const promptQuestion = `\n\nHere is their question: ${question}\n\nNote that the person asking this question actually does not know the structure of the events I am giving you, so do not refer to any specific columns in the dataset. Please provide a response that I can send to this analyst.`;

    const response = await QuestionAnswerService.getCompletionResponse(
      `${promptPrefix}${promptDataInput}${promptQuestion}`,
      1,
      300
    );

    Logger.sendLog(
      `Asked question for ${integration.type}: ${question}\n\nResponse: ${response}`,
      `/questions/${organization.slug}`,
      user.email
    );

    return response;
  },
  getCompletionResponse: async (
    prompt: string,
    temperature?: number,
    maxTokens?: number
  ) => {
    const completion = await OpenAI.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "assistant", content: prompt }],
      n: 1,
      temperature,
      max_tokens: maxTokens,
    });
    return completion.data.choices[0]?.message?.content || "";
  },
};
