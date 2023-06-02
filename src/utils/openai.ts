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
      prompt: `Say "true" if the following message from a user is only a greeting or expression of gratitude. Examples of these are: "thanks!", "hello", "is anyone here", "thank you". If the message includes more than a simple greeting or expression of gratitude, say "false". Here's an example of a message you should say "false" for: "thanks, but when I try doing that I'm still having the problem." Here is the message:\n${message}`,
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
    const isUnrelated =
      gptResponse.toLowerCase().includes("unrelated") &&
      gptResponse.toLowerCase().includes("logtree");

    void MyLogtree.sendLog({
      content: `GPT response: ${gptResponse}\n\nAre the Logtree logs related: ${!isUnrelated}`,
      folderPath: "/support-bot-responses",
    });

    return !isUnrelated;
  },
};
