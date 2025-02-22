import * as builtIns from "./built-ins";
import { BinaryTypeParser } from "./mod";

/**
 * A default instance of a {@link BinaryTypeParser} that includes all built-in
 * types. Additional types may be registered using the `register` method.
 *
 * To minimize the bundle size, consider using a custom {@link BinaryTypeParser}
 * and registering only the types that are needed. Built-in types may be
 * imported and registered individually to enable tree-shaking.
 */
export const defaultBinaryTypeParser = new BinaryTypeParser();
for (const type of Object.values(builtIns)) {
  defaultBinaryTypeParser.register(type);
}
