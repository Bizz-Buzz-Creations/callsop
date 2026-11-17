// Netlify Function entry point. All logic lives in ../api/routes.js.
// It is reached through the /api/* rewrite in netlify.toml, which sends the request
// to /.netlify/functions/api/<rest of the path>. (Do not add `config.path` here: a
// function with its own path is no longer served at /.netlify/functions/api, and the
// rewrite would then lead to a 404.)
import { handle } from "../api/routes.js";

export default async (request, context) => handle(request, { ip: context?.ip });
