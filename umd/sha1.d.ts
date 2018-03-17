/**
 * Hashes data to a SHA1 hex string.
 *
 * @param data data to hash
 */
export default function sha1(data: ArrayBuffer | Uint8Array | string): PromiseLike<string>;
