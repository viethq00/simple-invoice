// Must be the first import in login-rate-limit.e2e-spec.ts so it runs before the config
// loads. test-env.ts resets both values for the other suites.
process.env.LOGIN_RATE_LIMIT = '3';
process.env.TRUST_PROXY = '1';
