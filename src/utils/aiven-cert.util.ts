// src/utils/aiven-cert.util.ts
import * as fs from 'fs';
import * as path from 'path';

export function prepareAivenCert(): string | undefined {
  const b64 = process.env.AIVEN_CA_B64;
  if (!b64) return undefined;

  const outPath = path.join('/tmp', 'ca.pem');

  if (!fs.existsSync(outPath)) {
    const buffer = Buffer.from(b64, 'base64');
    fs.writeFileSync(outPath, buffer);
  }

  return outPath;
}
