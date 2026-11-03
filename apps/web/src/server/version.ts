import packageJson from "../../package.json";

export const SERVER_VERSION: string = packageJson.version;
/** Bump when a breaking API change requires mobile clients to update. */
export const MIN_CLIENT_VERSION = "0.1.0";
