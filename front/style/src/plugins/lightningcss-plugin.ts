import { join } from 'node:path'
import browserslist from 'browserslist'
import { browserslistToTargets, bundle } from 'lightningcss'
import type { CustomAtRules, TransformOptions } from 'lightningcss'

const IMPORT_STYLE = 'import { injectStyle } from "@solenopsys/converged-style";'

export type LightningcssPluginOptions<C extends CustomAtRules> = Omit<TransformOptions<C>, 'filename' | 'code'> & {
  browserslist?: string | readonly string[]
}

export default function lightningcssPlugin<C extends CustomAtRules>(options: LightningcssPluginOptions<C> = {}): import('bun').BunPlugin {
  return {
    name: 'bun-lightningcss',
    setup({ onLoad, onResolve, config }) {
      const defaultOptions: LightningcssPluginOptions<C> = {
        minify: true,
        sourceMap: true,
        cssModules: true,
        projectRoot: join(process.cwd(), config.outdir || 'dist'),
      }
      const { browserslist: browserslistOpts, ...lightningOpts } = options ?? {}
      const targets = browserslistToTargets(browserslist(browserslistOpts))

    

      const quote = JSON.stringify
      const escape = (string: string) => quote(string).slice(1, -1)

      if (defaultOptions.cssModules) {
        onLoad({ filter: /\.module\.css$/ }, ({ path }) => {
          const { code, exports = {} } = bundle({
            filename: path,
            ...defaultOptions,
            targets,
            ...lightningOpts,
          })

          let contents = ''

          const dependencies = new Map<string, string>()

          const importDependency = (path: string) => {
            if (dependencies.has(path))
              return dependencies.get(path)

            const dependenciesName = `dependency_${dependencies.size}`
            // prepend dependency to to the contents
            contents = `import ${dependenciesName} from ${quote(path)}\n${contents}`
            dependencies.set(path, dependenciesName)
            return dependenciesName
          }

          contents += IMPORT_STYLE
          contents += `injectStyle(${quote(code.toString())})\n`
          contents += 'export default {'

          // Credits to https://github.com/mhsdesign/esbuild-plugin-lightningcss-modules
          for (const [cssClassReadableName, cssClassExport] of Object.entries(exports)) {
            let compiledCssClasses = `"${escape(cssClassExport.name)}`

            if (cssClassExport.composes) {
              for (const composition of cssClassExport.composes) {
                switch (composition.type) {
                  case 'local':
                  case 'global':
                    compiledCssClasses += ` ${escape(composition.name)}`
                    break
                  case 'dependency':
                    compiledCssClasses += ` " + ${importDependency(composition.specifier)}[${quote(composition.name)}] + "`
                    break
                }
              }
            }

            compiledCssClasses += '"'

            contents += `${JSON.stringify(cssClassReadableName)}:${compiledCssClasses},`
          }

          contents += '}'

          // https://github.com/evanw/esbuild/issues/2943#issuecomment-1439755408
          const emptyishSourceMap = 'data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIiJdLCJtYXBwaW5ncyI6IkEifQ=='
          contents += `\n//# sourceMappingURL=${emptyishSourceMap}`

          return {
            contents,
            loader: 'js',
          }
        })
      }

      onLoad({ filter: /^.*\.css(?!\.module\.css)$/ }, ({ path }) => {
        const { code } = bundle({
          filename: path,
          ...defaultOptions,
          targets,
          ...lightningOpts,
          cssModules: false,
        })

        const contents = `
        ${IMPORT_STYLE}
        injectStyle(${quote(code.toString())})

        export default {}
        `

        return {
          contents,
          loader: 'js',
        }
      })
    },
  }
}