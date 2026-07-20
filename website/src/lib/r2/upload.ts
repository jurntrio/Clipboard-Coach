import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
  }
});

export async function getUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType
  });

  return getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

// R2 (like S3) rejects a single PUT over ~5GB, so anything bigger - drone
// footage especially - has to go through multipart upload instead.
export async function createMultipartUpload(key: string, contentType: string) {
  const res = await r2Client.send(
    new CreateMultipartUploadCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, ContentType: contentType })
  );
  return res.UploadId!;
}

export async function getPartUploadUrl(key: string, uploadId: string, partNumber: number) {
  const command = new UploadPartCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber
  });
  return getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[]
) {
  await r2Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    })
  );
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  await r2Client.send(
    new AbortMultipartUploadCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, UploadId: uploadId })
  );
}

export function getPublicUrl(key: string) {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
