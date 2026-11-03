import { get, Agent } from "node:http";
// Local health traffic must not depend on an outbound HTTP proxy.
const request = get(
  {
    hostname: "127.0.0.1",
    port: process.env.PORT ?? "3000",
    path: "/api/health",
    agent: new Agent({ keepAlive: false, proxyEnv: {} }),
    timeout: 4000,
  },
  (response) => {
    response.resume();
    process.exitCode = response.statusCode === 200 ? 0 : 1;
  },
);
request.on("timeout", () => request.destroy(new Error("Health check timeout")));
request.on("error", () => {
  process.exitCode = 1;
});
