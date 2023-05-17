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

    const promptPrefix = `I am giving you all of the events from one business's ${integration.type} account:\n\n`;
    const promptDataInput = _arrayToMarkdown(logsFromIntegration).slice(
      0,
      3000
    );
    const promptQuestion = `\n\nHere is their question: ${question}\n\nYou must use reasoning and possibly math to make a useful and insightful response to the question. It is important to remember that the person asking the question does not know the structure of the data I am giving you, so do not speak too technically. Be nice with your response, and only include the most important details.`;

    const response = await QuestionAnswerService.getCompletionResponse(
      `${promptPrefix}${promptDataInput}${promptQuestion}`
    );

    Logger.sendLog(
      `Asked question for ${integration.type}: ${question}\n\nResponse: ${response}`,
      `/questions/${organization.slug}`,
      user.email
    );

    return response;
  },
  getCompletionResponse: async (prompt: string) => {
    const completion = await OpenAI.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });
    return completion.data.choices[0]?.message?.content || "";
  },
};
