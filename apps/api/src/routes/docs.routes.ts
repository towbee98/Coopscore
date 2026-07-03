import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { load as loadYaml } from "js-yaml";
import swaggerUi from "swagger-ui-express";

// openapi.yaml is hand-maintained to match the actual implementation, not
// generated from route decorators — see the file's own header comment.
const openapiPath = fileURLToPath(new URL("../../openapi.yaml", import.meta.url));
const openapiDocument = loadYaml(readFileSync(openapiPath, "utf-8")) as Record<string, unknown>;

export const docsRouter = Router();

docsRouter.use("/", swaggerUi.serve, swaggerUi.setup(openapiDocument));
