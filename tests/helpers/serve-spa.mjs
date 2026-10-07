import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('dist/spa')
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

http
  .createServer((request, response) => {
    let target = path.resolve(
      root,
      `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`,
    )
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end()
      return
    }
    if (!fs.existsSync(target) || !fs.statSync(target).isFile())
      target = path.join(root, 'index.html')
    response.writeHead(200, {
      'Content-Type': types[path.extname(target)] || 'application/octet-stream',
    })
    fs.createReadStream(target).pipe(response)
  })
  .listen(18789, '127.0.0.1')
