import http from "node:http";

import { createSynclyServiceRouter } from "../tsp-output/server/js/src/generated/http/router.js";
import { pagesController } from "./modules/pages/pages.controller.js";
import { participantsController } from "./modules/participants/participants.controller.js";

const port = Number(process.env.PORT ?? 3000);
const router = createSynclyServiceRouter(pagesController, participantsController);

http.createServer(router.dispatch).listen(port, () => {
  console.log(`Syncly API listening on http://localhost:${port}`);
});
