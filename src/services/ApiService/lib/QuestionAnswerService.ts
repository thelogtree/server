import { OrganizationDocument, UserDocument } from "logtree-types";
import { Integration } from "src/models/Integration";
import { SecureIntegrationService } from "src/services/integrations/SecureIntegrationService";
import { ApiError } from "src/utils/errors";
import { Configuration, OpenAIApi } from "openai";
import { config } from "src/utils/config";
import { Logger } from "src/utils/logger";

const configuration = new Configuration({
  apiKey: config.openai.apiKey,
});
const OpenAI = new OpenAIApi(configuration);

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
      SecureIntegrationService.getCorrectLogsFunctionToRun(integration);
    const logsFromIntegration = await getLogsFxn!(organization, integration);

    const promptPrefix = `I am giving you a lot of data from one business's ${integration.type} account. Someone from the business is asking you a question about this data and your job is to try your best to answer it. If the question has nothing to do with the data, you have permission to tell them that. If you think you are unable to answer a question you must ignore data you don't think is related to the question and make reasonable assumptions about all data such as inferring the meaning of certain words. Chances are that you just need to infer the meaning of some things in the data for a question to make more sense. If their question is asking you to provide conclusions from the data or aggregate data from these individual events, you should try your best to do so and do whatever is necessary including mathematical calculations. Below is their data, represented as a stringified array of objects of recent events from their ${integration.type} account:\n\n`;
    const promptDataInput = JSON.stringify(logsFromIntegration).slice(0, 3000);
    const promptQuestion = `\n\nAnd here is their question: ${question}`;

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
