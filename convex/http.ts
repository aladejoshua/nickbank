import { httpRouter } from "convex/server";
import { corsRouter } from "convex-helpers/server/cors";

const http = httpRouter();
const cors = corsRouter(http, {
  allowedOrigins: ["*"],
});

export default cors.http;
