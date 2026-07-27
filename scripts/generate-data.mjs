import fs from 'fs';
import path from 'path';

const TOTAL_RECORDS = 1000000;
const publicDir = path.join(process.cwd(), 'public');
const filePath = path.join(publicDir, 'customers.json');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });
stream.write('[\n');

for (let i = 1; i <= TOTAL_RECORDS; i++) {
  const customer = {
    id: i,
    name: `Customer ${i}`,
    email: `customer${i}@example.com`
  };

  const isLast = i === TOTAL_RECORDS;
  stream.write(`  ${JSON.stringify(customer)}${isLast ? '' : ','}\n`);
}

stream.write(']\n');
stream.end();

console.log(`Successfully generated ${TOTAL_RECORDS} customer records at ${filePath}`);
