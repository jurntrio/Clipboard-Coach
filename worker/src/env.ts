function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  workerSharedSecret: required("WORKER_SHARED_SECRET"),
  r2AccountId: required("R2_ACCOUNT_ID"),
  r2AccessKeyId: required("R2_ACCESS_KEY_ID"),
  r2SecretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  r2BucketName: required("R2_BUCKET_NAME"),
  r2PublicUrl: required("R2_PUBLIC_URL"),
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  port: Number(process.env.PORT ?? 8080)
};
