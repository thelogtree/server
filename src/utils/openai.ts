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
      max_tokens: 300,
    });

    return completion.data.choices[0].message?.content;
  },
  getIsSupportMessageWorthRespondingTo: async (message: string) => {
    const completion = await MyOpenAI.createCompletion({
      model: "text-babbage-001",
      prompt: `Say "true" if the following message from a user is just a simple greeting or thank you phrase and nothing else. Examples of these are: "thanks!", "hello", "is anyone here", "thank you". Say "false" otherwise. If a message is at least one sentence long then say "true" regardless of the contents of the message. Here is the message:\n${message}`,
      temperature: 0,
      max_tokens: 50,
    });
    const textResult = completion.data.choices[0].text || "";
    const isWorthRespondingTo = textResult.includes("true");

    void MyLogtree.sendLog({
      content: `Message: ${message}\n\nWill respond to it: ${isWorthRespondingTo}`,
      folderPath: "/support-bot-responses",
      additionalContext: {
        gptResponse: textResult,
      },
    });

    return isWorthRespondingTo;
  },
};
