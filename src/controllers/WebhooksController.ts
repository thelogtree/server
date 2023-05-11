import { Request, Response } from "express";
import { IntercomService } from "src/services/integrations/components/IntercomService";
import { config } from "src/utils/config";
import { AuthError } from "src/utils/errors";

export const WebhooksController = {
  // when someone removes their logtree <> intercom connection inside intercom instead of logtree.
  removedIntercomConnection: async (req: Request, res: Response) => {
    if (
      !config.environment.isTest &&
      !IntercomService.verifyWebhookCameFromTrustedSource!(
        req.headers,
        req.body
      )
    ) {
      throw new AuthError(
        "Could not verify that this request came from Intercom."
      );
    }
    await IntercomService.removedOAuthConnectionElsewhereAndNeedToUpdateOurOwnRecords!(
      req.body as any
    );

    res.send({});
  },
};
