import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Regenerate the PWA icons in public/ with `npx pwa-assets-generator`
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/pwa-icon.svg'],
})
