/**
 * Zero-dependency browser & Node compatible Protobuf decoder for
 * Yahoo Finance real-time WebSocket stream (wss://streamer.finance.yahoo.com/).
 */

export interface YahooStreamTick {
  id: string;
  price: number;
  time: number;
  changePercent: number | null;
  change: number | null;
  bid: number | null;
  ask: number | null;
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }
  // Node.js fallback for unit testing
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

export function decodeYahooPricingData(base64Payload: string): YahooStreamTick | null {
  try {
    const bytes = base64ToBytes(base64Payload);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const textDecoder = new TextDecoder('utf-8');

    let offset = 0;
    let id = '';
    let price = NaN;
    let time = 0;
    let changePercent: number | null = null;
    let change: number | null = null;
    let bid: number | null = null;
    let ask: number | null = null;

    const readVarint = (): bigint => {
      let result = 0n;
      let shift = 0n;
      while (offset < bytes.length) {
        const byte = bytes[offset++];
        result |= BigInt(byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7n;
      }
      return result;
    };

    const zigzagDecode = (n: bigint): number => {
      return Number((n >> 1n) ^ -(n & 1n));
    };

    while (offset < bytes.length) {
      const tag = Number(readVarint());
      const fieldNum = tag >> 3;
      const wireType = tag & 7;

      if (wireType === 0) {
        const val = readVarint();
        if (fieldNum === 3) {
          time = zigzagDecode(val);
        }
      } else if (wireType === 1) {
        if (offset + 8 > bytes.length) break;
        offset += 8;
      } else if (wireType === 2) {
        const len = Number(readVarint());
        if (len < 0 || offset + len > bytes.length) break;
        if (fieldNum === 1) {
          id = textDecoder.decode(bytes.subarray(offset, offset + len));
        }
        offset += len;
      } else if (wireType === 5) {
        if (offset + 4 > bytes.length) break;
        const val = view.getFloat32(offset, true);
        offset += 4;
        if (fieldNum === 2) price = val;
        else if (fieldNum === 8) changePercent = Number.isFinite(val) ? val : null;
        else if (fieldNum === 12) change = Number.isFinite(val) ? val : null;
        else if (fieldNum === 23 && Number.isFinite(val) && val > 0) bid = val;
        else if (fieldNum === 25 && Number.isFinite(val) && val > 0) ask = val;
      } else {
        break;
      }
    }

    if (!id || !Number.isFinite(price) || price <= 0) {
      return null;
    }

    return {
      id,
      price,
      time: time > 0 ? time : Date.now(),
      changePercent,
      change,
      bid,
      ask,
    };
  } catch {
    return null;
  }
}
