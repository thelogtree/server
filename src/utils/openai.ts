import { Configuration, OpenAIApi } from "openai";
import { config } from "./config";
import { MyLogtree } from "./logger";
import { SimplifiedLog } from "src/services/ApiService/lib/LogService";

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
    const hasLogtree = gptResponse.toLowerCase().includes("logtree");
    const isUnrelated =
      gptResponse.toLowerCase().includes("unrelated") ||
      gptResponse.toLowerCase().includes("no events");

    const isUnrelatedDecision = isUnrelated && hasLogtree;

    void MyLogtree.sendLog({
      content: `GPT response: ${gptResponse}\n\nAre the Logtree logs related: ${!isUnrelatedDecision}`,
      folderPath: "/support-bot-responses",
    });

    return !isUnrelatedDecision;
  },
  askQuestionAboutUserActivity: async (
    question: string,
    logsString: string
  ) => {
    const completion = await MyOpenAI.createChatCompletion({
      model: "gpt-3.5-turbo-16k",
      messages: [
        {
          role: "system",
          content: `You are an expert data analyst for a company and you must try your best to answer a question about a specific user. Here is the question: "${question}"\n\nUse the events below to help answer the question. These events represent the user's activity in the app in chronological order from newest to oldest.\n${logsString}`,
        },
      ],
      temperature: 0.6,
      max_tokens: 500,
    });

    return completion.data.choices[0].message?.content;
  },
  diagnoseProblem: async (logsString: string) => {
    const completion = await MyOpenAI.createChatCompletion({
      model: "gpt-3.5-turbo-16k",
      messages: [
        {
          role: "system",
          content: `You are an expert support engineer and a user messaged in about a problem they are experiencing. Your job is to look through the user's recent errors, using their messages to customer support as context, and summarize what the problem is. Your summary must be easily understandable and brief. Here are the user's errors and support messages in chronological order from newest to oldest.\n${logsString}`,
        },
      ],
      temperature: 0.6,
      max_tokens: 500,
    });

    return completion.data.choices[0].message?.content;
  },
  transformLogContextIntoString: (logContext: SimplifiedLog[]) => {
    let str = "------";

    logContext.forEach((log) => {
      if (str.length > 6) {
        str += "\n------\n";
      }
      str += `Log from ${log.sourceTitle} (${
        log.tag || "logging"
      } service) recorded at ${log.createdAt}:\n`;
      str += `${log.content.replace(/(\r\n|\n|\r)/gm, "")}`;
    });

    return str;
  },
};
