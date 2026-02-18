/**
 * Global TypeScript declarations for build-time constants
 * These are injected by tsup's define option during the build process
 */

declare const __SPARK_VERSION__: string;
declare const __SPARK_NAME__: string;

declare namespace NodeJS {
  interface ProcessEnv {
    SPARK_BUILD_MODE?: string;
  }
}
