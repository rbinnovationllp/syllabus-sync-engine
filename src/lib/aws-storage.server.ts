import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function schoolStorageBucket() {
  return requiredEnv("AWS_S3_BUCKET");
}

function s3Client() {
  return new S3Client({
    region: requiredEnv("AWS_REGION"),
    credentials: {
      accessKeyId: requiredEnv("AWS_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("AWS_SECRET_ACCESS_KEY"),
    },
  });
}

export function safeStorageFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[^\w.\- ()]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120) || "school-file";
}

export function schoolStorageKey(orgId: string, objectId: string, fileName: string) {
  return `schools/${orgId}/files/${objectId}-${safeStorageFileName(fileName)}`;
}

export async function createSchoolUploadUrl(input: {
  key: string;
  contentType: string;
  sizeBytes: number;
}) {
  const command = new PutObjectCommand({
    Bucket: schoolStorageBucket(),
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
  });

  return getSignedUrl(s3Client(), command, { expiresIn: 10 * 60 });
}

export async function createSchoolDownloadUrl(key: string, fileName: string) {
  const command = new GetObjectCommand({
    Bucket: schoolStorageBucket(),
    Key: key,
    ResponseContentDisposition: `attachment; filename="${safeStorageFileName(fileName)}"`,
  });

  return getSignedUrl(s3Client(), command, { expiresIn: 10 * 60 });
}

export async function deleteSchoolStorageObject(key: string) {
  await s3Client().send(
    new DeleteObjectCommand({
      Bucket: schoolStorageBucket(),
      Key: key,
    }),
  );
}
