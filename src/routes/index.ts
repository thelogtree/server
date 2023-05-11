import expressRouter from "express-promise-router";

import onlyTestRoutes from "./nonApi/onlyTestRoutes";
import organization from "./nonApi/organization";
import webhooks from "./nonApi/webhooks";
import logs from "./v1/logs";
import misc from "./v1/misc";

const router = expressRouter();

router.use("/only-test-routes", onlyTestRoutes);
router.use("/organization", organization);
router.use("/webhooks", webhooks);

// these are the routes that should be accessible from the API
router.use("/v1/logs", logs);
router.use("/v1/misc", misc);

export default router;
