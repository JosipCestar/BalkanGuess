import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";

// Never copy root .env files into dist/server/.dev.vars. Local Workers preview
// should use an explicit, gitignored .dev.vars file instead.
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV ??= "false";

export default defineConfig({
  plugins: [
    vinext({
      cache: { cdn: cdnAdapter() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
