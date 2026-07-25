import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.r2AccessKeyId,
    secretAccessKey: env.r2SecretAccessKey
  }
});

export async function downloadToFile(key: string, destPath: string) {
  const res = await client.send(new GetObjectCommand({ Bucket: env.r2BucketName, Key: key }));
  if (!res.Body) throw new Error(`R2 object has no body: ${key}`);
  await pipeline(res.Body as NodeJS.ReadableStream, fs.createWriteStream(destPath));
}

export async function uploadFile(key: string, filePath: string, contentType: string) {
  await client.send(
    new PutObjectCommand({
      Bucket: env.r2BucketName,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType
    })
  );
  return getPublicUrl(key);
}

export async function deleteObject(key: string) {
  await client.send(new DeleteObjectCommand({ Bucket: env.r2BucketName, Key: key }));
}

export function getPublicUrl(key: string) {
  return `${env.r2PublicUrl}/${key}`;
}
