/** Explicit local development mode. Production always keeps normal authentication. */
export function isLocalDemo() {
  return (
    process.env.NODE_ENV === "development" && process.env.DZ_LOCAL_DEMO === "1"
  );
}
