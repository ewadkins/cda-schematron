interface ITextEncoder {
    encode(data: string): Uint8Array;
}

interface ITextEncoderCons {
    new(charset: string): ITextEncoder;
}

declare var TextEncoder: ITextEncoderCons;
let stringToUint8: (data: string) => Uint8Array;
let sha1hex: PromiseLike<(data: ArrayBuffer | Uint8Array) => PromiseLike<string>>;

if (typeof TextEncoder !== "undefined") {
    stringToUint8 = (data: string) => new TextEncoder("utf-8").encode(data);
} else if (typeof Buffer !== "undefined") {
    stringToUint8 = (data: string) => Buffer.from(data, "utf8");
} else {
    stringToUint8 = () => {
        throw new Error("No strategy for encoding text");
    };
}

if (typeof crypto !== "undefined" && crypto.subtle) {
    const hex = (data: ArrayBuffer) =>
        Array.from(new Uint8Array(data)).map((b) => ("00" + b.toString(16)).slice(-2)).join("");
    sha1hex = Promise.resolve((data: ArrayBuffer | Uint8Array) => {
        const hexstr: PromiseLike<string> = crypto.subtle.digest("SHA-1", data).then(hex);
        return hexstr;
    });
} else {
    let toBuffer: (data: ArrayBuffer | Uint8Array) => Buffer;

    if (typeof Buffer === "undefined") {
        toBuffer = (data: ArrayBuffer | Uint8Array) => {
            const arr =  data instanceof ArrayBuffer ? new Uint8Array(data) : data;
            return arr as Buffer;
        };
    } else {
        toBuffer = (data: ArrayBuffer | Uint8Array) => {
            if (data instanceof Buffer) {
                return data as Buffer;
            }
            const arr =  data instanceof ArrayBuffer ? data
                : data.buffer.slice(data.byteOffset, data.byteLength - data.byteOffset);
            return Buffer.from(arr);
        };
    }

    sha1hex = import("crypto").then((crpt) => (data: ArrayBuffer | Uint8Array) => {
        const hexstr = Promise.resolve(crpt.createHash("sha1").update(toBuffer(data)).digest("hex"));
        return hexstr;
    });
}

/**
 * Hashes data to a SHA1 hex string.
 *
 * @param data data to hash
 */
export default function sha1(data: ArrayBuffer | Uint8Array | string) {
    const d = typeof data === "string" ? stringToUint8(data) : data;
    return sha1hex.then((f) => f(d));
}
