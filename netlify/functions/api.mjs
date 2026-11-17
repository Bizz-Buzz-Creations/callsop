// Netlify Function entry point. All logic lives in ../api/routes.js.
import { handle } from "../api/routes.js";

export default async (request, context) => handle(request, { ip: context?.ip });

// Serve every /api/... URL from this one function.
export const config = { path: "/api/*" };
