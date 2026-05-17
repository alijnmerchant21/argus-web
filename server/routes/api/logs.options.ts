import { defineEventHandler, setResponseHeaders } from "h3";
import { corsHeaders } from "../../utils/api";

export default defineEventHandler((event) => {
  setResponseHeaders(event, corsHeaders());
  event.node.res.statusCode = 204;
});
