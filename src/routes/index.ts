import expressRouter from "express-promise-router";
import organization from "./v1/organization";

const router = expressRouter();

router.use("/organization", organization);

export default router;
