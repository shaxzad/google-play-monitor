// Registers the .js -> .ts resolve hook so `node --test` can execute the
// TypeScript sources directly via Node's built-in type stripping.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./ts-js-resolver.mjs", pathToFileURL(import.meta.url));
