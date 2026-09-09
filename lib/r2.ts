import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let client: S3Client | undefined;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Cloudflare R2.`);
  return value;
}

function bucket() {
  return required("R2_BUCKET_NAME");
}

function r2Client() {
  if (!client) {
    const accountId = required("R2_ACCOUNT_ID");
    client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

function notFound(error: unknown) {
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate?.name === "NotFound" || candidate?.name === "NoSuchKey" || candidate?.$metadata?.httpStatusCode === 404;
}

export function remoteCatalogEnabled() {
  return process.env.CATALOG_STORAGE === "r2";
}

export async function readR2Text(key: string) {
  try {
    const result = await r2Client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    return result.Body ? await result.Body.transformToString("utf-8") : null;
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

export async function putR2Object(key: string, body: Uint8Array | string, contentType: string) {
  await r2Client().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: contentType === "audio/mpeg" ? "private, max-age=31536000, immutable" : "private, no-store",
  }));
}

export async function r2ObjectExists(key: string) {
  try {
    await r2Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch (error) {
    if (notFound(error)) return false;
    throw error;
  }
}

export async function deleteR2Object(key: string) {
  await r2Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
