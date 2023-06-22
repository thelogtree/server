import axios from "axios";
import { config } from "src/utils/config";

export const IFramelyUtil = {
  getSiteInfo: async (url: string) => {
    const res = await axios.get(
      `https://iframe.ly/api/oembed?url=${url}&api_key=${config.iframely.apiKey}`
    );
    const { html } = res.data;
    return {
      html,
    };
  },
};
