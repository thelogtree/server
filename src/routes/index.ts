import expressRouter from "express-promise-router";

import onlyTestRoutes from "./nonApi/onlyTestRoutes";
import organization from "./nonApi/organization";
import logs from "./v1/logs";

const router = expressRouter();

router.use("/only-test-routes", onlyTestRoutes);
router.use("/organization", organization);

// these are the routes that should be accessible from the API
router.use("/v1/logs", logs);

export default router;
