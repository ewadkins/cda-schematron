let stringToUint8;
let sha1hex;
if (typeof TextEncoder !== "undefined") {
    stringToUint8 = (data) => new TextEncoder("utf-8").encode(data);
}
else if (typeof Buffer !== "undefined") {
    stringToUint8 = (data) => Buffer.from(data, "utf8");
}
else {
    stringToUint8 = () => {
        throw new Error("No strategy for encoding text");
    };
}
if (typeof crypto !== "undefined" && crypto.subtle) {
    const hex = (data) => Array.from(new Uint8Array(data)).map((b) => ("00" + b.toString(16)).slice(-2)).join("");
    sha1hex = Promise.resolve((data) => {
        const hexstr = crypto.subtle.digest("SHA-1", data).then(hex);
        return hexstr;
    });
}
else {
    let toBuffer;
    if (typeof Buffer === "undefined") {
        toBuffer = (data) => {
            const arr = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
            return arr;
        };
    }
    else {
        toBuffer = (data) => {
            if (data instanceof Buffer) {
                return data;
            }
            const arr = data instanceof ArrayBuffer ? data
                : data.buffer.slice(data.byteOffset, data.byteLength - data.byteOffset);
            return Buffer.from(arr);
        };
    }
    sha1hex = import("crypto").then((crpt) => (data) => {
        const hexstr = Promise.resolve(crpt.createHash("sha1").update(toBuffer(data)).digest("hex"));
        return hexstr;
    });
}
/**
 * Hashes data to a SHA1 hex string.
 *
 * @param data data to hash
 */
export default function sha1(data) {
    const d = typeof data === "string" ? stringToUint8(data) : data;
    return sha1hex.then((f) => f(d));
}
//# sourceMappingURL=sha1.js.map