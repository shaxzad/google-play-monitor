// Minimal resolve hook: lets Node's built-in TypeScript type-stripping load
// ESM sources that import sibling modules with a ".js" specifier while the
// files on disk are ".ts". When a ".js" specifier fails to resolve, retry
// with ".ts". Pure JS so it works without any build step.

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      specifier.startsWith(".") &&
      specifier.endsWith(".js")
    ) {
      const tsSpecifier = specifier.slice(0, -3) + ".ts";
      return nextResolve(tsSpecifier, context);
    }

    throw error;
  }
}
