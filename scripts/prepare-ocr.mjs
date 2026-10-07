import fs from 'node:fs/promises'
import path from 'node:path'

const ocr = path.resolve('public/ocr')
await fs.mkdir(ocr, { recursive: true })
await fs.copyFile('node_modules/tesseract.js/dist/worker.min.js', path.join(ocr, 'worker.min.js'))
await fs.copyFile('node_modules/@techstark/opencv-js/dist/opencv.js', path.join(ocr, 'opencv.js'))
await fs.copyFile('src/utils/prepararCnh.worker.js', path.join(ocr, 'preparar-cnh.worker.js'))
const core = 'node_modules/tesseract.js-core'
for (const file of await fs.readdir(core)) {
  if (/^tesseract-core(?:-simd|-relaxedsimd)?-lstm\.wasm(?:\.js)?$/.test(file)) {
    await fs.copyFile(path.join(core, file), path.join(ocr, file))
  }
}
await fs.copyFile(
  'node_modules/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz',
  path.join(ocr, 'por.traineddata.gz'),
)
for (const directory of ['standard_fonts', 'cmaps', 'wasm']) {
  await fs.cp(`node_modules/pdfjs-dist/${directory}`, `public/pdfjs/${directory}`, {
    recursive: true,
  })
}
console.log('Arquivos de OpenCV, OCR e PDF.js preparados para uso local.')
