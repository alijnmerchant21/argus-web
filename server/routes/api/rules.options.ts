import { defineEventHandler, setResponseHeaders } from "h3";
import { corsHeaders } from "../../utils/api";

/** CORS preflight for extension + browser clients (chrome-extension:// origins). */
export default defineEventHandler((event) => {
  setResponseHeaders(event, corsHeaders());
  event.node.res.statusCode = 204;
});
