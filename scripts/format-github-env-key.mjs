import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
let s = fs.readFileSync(envPath, 'utf8');

const start = 'GITHUB_APP_PRIVATE_KEY="';
const i = s.indexOf(start);
if (i < 0) {
	console.error('GITHUB_APP_PRIVATE_KEY= not found');
	process.exit(1);
}

const rsaEnd = '-----END RSA PRIVATE KEY-----"';
const pkcs8End = '-----END PRIVATE KEY-----"';
let k = s.indexOf(rsaEnd, i);
let endMarker = rsaEnd;
if (k < 0) {
	k = s.indexOf(pkcs8End, i);
	endMarker = pkcs8End;
}
if (k < 0) {
	console.error('End of PEM not found (expected END RSA PRIVATE KEY or END PRIVATE KEY)');
	process.exit(1);
}

const end = k + endMarker.length;
// `end` is the index *after* the closing `"` of the value; PEM is everything between opening `"` and that closing quote.
const inner = s.slice(i + start.length, end - 1);
const pem = inner.replace(/\r\n/g, '\n').trim();
const escaped = pem.split('\n').join('\\n');
const newVar = `${start}${escaped}"\n`;

s = s.slice(0, i) + newVar + s.slice(end);
fs.writeFileSync(envPath, s);
console.log('Reformatted GITHUB_APP_PRIVATE_KEY to a single line with \\n escapes.');
