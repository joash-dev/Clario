import { env } from "./config/env";
import { createApp } from "./app";

const app = createApp();

const host = "0.0.0.0";
app.listen(env.PORT, host, () => {
  console.log(
    `Clario API listening on http://localhost:${env.PORT} (${env.NODE_ENV}) — use your LAN IP for phones: http://<this-machine>:${env.PORT}/api/v1`
  );
});
