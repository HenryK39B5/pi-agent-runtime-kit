import "../offline-bootstrap.mjs";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.env.PI_TEST_PACKAGE_ROOT;
if (!root) throw new Error("Set PI_TEST_PACKAGE_ROOT to the installed pi-coding-agent directory");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@earendil-works/pi-tui") {
      return next(pathToFileURL(`${root}/node_modules/@earendil-works/pi-tui/dist/index.js`).href, context);
    }
    return next(specifier, context);
  },
});
