import merge from "lodash/merge";
import { FunnelDocument } from "logtree-types";
import { FunnelFactory } from "./FunnelFactory";
import { FunnelCompletion } from "src/models/FunnelCompletion";

const getDefaultFields = async () => {
  const funnel: FunnelDocument = await FunnelFactory.create();

  return {
    funnelId: funnel._id,
    referenceId: "test-email@gmail.com",
  };
};

export const FunnelCompletionFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return FunnelCompletion.create(docFields);
  },
};
