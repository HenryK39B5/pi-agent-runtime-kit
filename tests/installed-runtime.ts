import "./offline-bootstrap.mjs";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
const root = process.env.PI_TEST_PACKAGE_ROOT;
if (!root) throw new Error("Set PI_TEST_PACKAGE_ROOT to the installed pi-coding-agent directory");
registerHooks({ resolve(specifier, context, next) {
  const files: Record<string, string> = {
    "@earendil-works/pi-coding-agent": `${root}/dist/index.js`,
    "@earendil-works/pi-ai": `${root}/node_modules/@earendil-works/pi-ai/dist/index.js`,
    "typebox": `${root}/node_modules/typebox/build/index.mjs`,
  };
  return next(files[specifier] ? pathToFileURL(files[specifier]).href : specifier, context);
} });
