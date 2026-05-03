import { createApp } from "./app.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";

const app = createApp();
const host = "0.0.0.0";

app.listen(env.PORT, host, () => {
  logger.info({ port: env.PORT, host }, "Bella backend listening");
});
