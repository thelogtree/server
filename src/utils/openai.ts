import { Configuration, OpenAIApi } from "openai";
import { config } from "./config";

const configuration = new Configuration({
  apiKey: config.openai.apiKey,
});
const MyOpenAI = new OpenAIApi(configuration);

export const OpenAI = {
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
};
