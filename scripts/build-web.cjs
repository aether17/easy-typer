const { spawnSync } = require('child_process')
require('./prepare-static.cjs')

// Webpack 4 uses MD4. Keep this compatibility flag scoped to the build process.
const env = { ...process.env }
if (Number(process.versions.node.split('.')[0]) >= 17) {
  env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --openssl-legacy-provider`.trim()
}
const result = spawnSync(process.execPath, [require.resolve('@vue/cli-service/bin/vue-cli-service.js'), 'build'], {
  env,
  stdio: 'inherit'
})
process.exit(result.status === null ? 1 : result.status)
