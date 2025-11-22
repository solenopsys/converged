import dts from 'bun-plugin-dts'

await Bun.build({
  entrypoints: ['./src/plugins/lightningcss-plugin.ts'],
  outdir: './dist/plugins',
  minify: true,
  plugins: [dts()],
  sourcemap: 'external',
  target: 'bun',
  external: ['lightningcss', 'browserslist'],
}).then((result) => {
 // console.log(result)
})