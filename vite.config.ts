import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import webExtension from "vite-plugin-web-extension";
import path from 'path';

export default defineConfig({
  root: "src",
  // Configure our outputs - nothing special, this is normal vite config
  plugins: [
    solidPlugin(),
    webExtension({
        manifest: path.resolve(__dirname, "src/manifest.json"),
        assets: "assets",
        webExtConfig: {
          firefox: "firefox",
        },
    }),
  ],
  build: {
    minify: 'terser',
    outDir: path.resolve(__dirname, "build/dist"),
    target: 'esnext',
    polyfillDynamicImport: false,
    emptyOutDir: true,
  },
});
