import 'dotenv/config';
import { uploadToR2 } from './lib/r2';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  console.log('Testing R2 configuration...');
  console.log('R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID);
  console.log('R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID);
  console.log('R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '***' : 'undefined');
  console.log('R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME);
  console.log('R2_PUBLIC_DOMAIN:', process.env.R2_PUBLIC_DOMAIN);

  const testFile = path.join(process.cwd(), 'r2-test.txt');
  await fs.writeFile(testFile, 'This is a test of the R2 upload from pipevideo pipeline.', 'utf-8');

  try {
    const r2Url = await uploadToR2(testFile, 'test-file.txt');
    console.log('R2 Upload Result:', r2Url);
  } catch (error) {
    console.error('R2 test script threw error:', error);
  } finally {
    await fs.unlink(testFile).catch(() => {});
  }
}

main();
