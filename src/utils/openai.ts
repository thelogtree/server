import { Configuration, OpenAIApi } from "openai";
import { config } from "./config";
import { MyLogtree } from "./logger";

const configuration = new Configuration({
  apiKey: config.openai.apiKey,
});
const MyOpenAI = new OpenAIApi(configuration);

export const OpenAIUtil = {
  getCompletionForCustomerSupportBot: async (
    contextLogs: string,
    supportLogAndInstructions: string
  ) => {
    const completion = await MyOpenAI.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `${supportLogAndInstructions}\n${contextLogs}`,
        },
      ],
      temperature: 0.6,
      max_tokens: 200,
    });

    return completion.data.choices[0].message?.content;
  },
  getIsSupportMessageWorthRespondingTo: async (message: string) => {
    const completion = await MyOpenAI.createCompletion({
      model: "text-curie-001",
      prompt: `Say "true" if the following message from a user is just a simple greeting or expression of gratitude and nothing else. Examples of these are: "thanks!", "hello", "is anyone here", "thank you". If it is not something like this or the message also contains a help question or problem they are facing, say "false". If you are not sure, say "false". Here is the message:\n${message}`,
      temperature: 0,
      max_tokens: 30,
    });
    const textResult = completion.data.choices[0].text || "";
    const isWorthRespondingTo = !textResult.includes("true");

    void MyLogtree.sendLog({
      content: `Message: ${message}\n\nWill respond to it: ${isWorthRespondingTo}`,
      folderPath: "/support-bot-responses",
      additionalContext: {
        gptResponse: textResult,
      },
    });

    return isWorthRespondingTo;
  },
  getAreLogsRelatedToMessage: async (gptResponse: string) => {
    const completion = await MyOpenAI.createCompletion({
      model: "text-curie-001",
      prompt: `Your job is to determine if a message generated by a bot provides any details about a user's actions. If the message does provide details about the user's actions, say "true". If it doesn't provide details about the user's actions, say "false". If you are unsure, say "true". Here is the bot's message:\n${gptResponse}`,
      temperature: 0,
      max_tokens: 30,
    });
    const textResult = completion.data.choices[0].text || "";
    const isRelated = textResult.includes("true");

    void MyLogtree.sendLog({
      content: `GPT response: ${gptResponse}\n\nAre the Logtree logs related: ${isRelated}`,
      folderPath: "/support-bot-responses",
      additionalContext: {
        gptResponse: textResult,
      },
    });

    return isRelated;
  },
};
