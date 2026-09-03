// Registers the .js -> .ts resolve hook so `node --test` can execute the
// TypeScript sources directly via Node's built-in type stripping.
import { register } from "node:module";

register("./ts-js-resolver.mjs", import.meta.url);
