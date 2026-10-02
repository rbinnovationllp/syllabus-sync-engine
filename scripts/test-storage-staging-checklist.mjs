const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "AWS_REGION", "AWS_S3_BUCKET"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`BLOCKED: staging configuration required: ${missing.join(", ")}`);
  process.exitCode = 2;
} else {
  console.log("READY: use isolated School A/School B test tenants and follow docs/PRODUCTION_STORAGE_SETUP.md.");
}
