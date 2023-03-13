import expressRouter from "express-promise-router";
import { OrganizationController } from "src/controllers/OrganizationController";

import auth from "../middleware/auth";

const router = expressRouter();

// only uncomment when running locally to create an organization
// router.post(
//   "/",
//   validateRequestAgainstSchemas({
//     bodySchema: OrganizationSchemas.createOrganization,
//   }),
//   OrganizationController.createOrganization
// );

router.get("/me", auth.requiredUser, OrganizationController.getMe);

export default router;
