/**
 * TypeScript Utility Types
 *
 * Shared utility types used throughout the application.
 */

/**
 * Utility type to await all properties of a type.
 * Converts all Promise properties to their resolved types.
 *
 * @example
 * type MyType = { foo: Promise<string>; bar: Promise<number> };
 * type Resolved = AwaitedProperties<MyType>; // { foo: string; bar: number }
 */
export type AwaitedProperties<T> = {
  [K in keyof T]: Awaited<T[K]>;
};
