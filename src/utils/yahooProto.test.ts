import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeYahooPricingData } from './yahooProto';

/**
 * Helper to encode a valid minimal Yahoo PricingData protobuf message for deterministic testing:
 * field 1 (string): id
 * field 2 (float32 LE): price
 * field 8 (float32 LE): changePercent
 */
function encodeMockYahooMessage(id: string, price: number, changePct: number): string {
  const idBytes = Buffer.from(id, 'utf8');
  const priceBuf = Buffer.alloc(4);
  priceBuf.writeFloatLE(price, 0);
  const chgBuf = Buffer.alloc(4);
  chgBuf.writeFloatLE(changePct, 0);

  const payload = Buffer.concat([
    Buffer.from([(1 << 3) | 2, idBytes.length]),
    idBytes,
    Buffer.from([(2 << 3) | 5]),
    priceBuf,
    Buffer.from([(8 << 3) | 5]),
    chgBuf,
  ]);
  return payload.toString('base64');
}

test('decodeYahooPricingData decodes real-time Forex and Stock Protobuf frames accurately', () => {
  const b64 = encodeMockYahooMessage('JPY=X', 159.267, 0.18);
  const decoded = decodeYahooPricingData(b64);
  assert.ok(decoded !== null);
  assert.equal(decoded.id, 'JPY=X');
  assert.ok(Math.abs(decoded.price - 159.267) < 0.001);
  assert.ok(decoded.changePercent !== null && Math.abs(decoded.changePercent - 0.18) < 0.001);
});

test('decodeYahooPricingData rejects malformed or zero-price payloads safely', () => {
  assert.equal(decodeYahooPricingData(''), null);
  assert.equal(decodeYahooPricingData('!!!invalid!!!'), null);
  assert.equal(decodeYahooPricingData(encodeMockYahooMessage('AAPL', 0, 0)), null);
});
