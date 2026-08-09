import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';

/**
 * Uploads a rendered MP4 file to Cloudflare R2.
 * Returns the public URL of the uploaded video, or null if configuration is missing or upload fails.
 */
export async function uploadToR2(filePath: string, fileName: string): Promise<string | null> {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_DOMAIN || process.env.CLOUDFLARE_R2_PUBLIC_URL;
  
  let endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
  if (!endpoint && process.env.R2_ACCOUNT_ID) {
    endpoint = `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`;
  }

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
    console.log('[R2 Upload] Skipping R2 upload: missing R2 credentials (R2_ACCESS_KEY_ID or R2_ACCOUNT_ID etc.)');
    return null;
  }

  console.log(`[R2 Upload] Uploading ${filePath} to R2 bucket "${bucketName}" as "${fileName}"...`);

  try {
    const s3 = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const fileContent = await fs.readFile(filePath);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: fileContent,
        ContentType: 'video/mp4',
      })
    );

    console.log(`[R2 Upload] Upload completed successfully for: ${fileName}`);

    if (publicUrl) {
      const cleanPublicUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
      return `${cleanPublicUrl}/${fileName}`;
    }

    // Fallback standard R2 endpoint construct
    return `${endpoint}/${bucketName}/${fileName}`;
  } catch (error) {
    console.error('[R2 Upload] Error during Cloudflare R2 upload:', error);
    return null;
  }
}
