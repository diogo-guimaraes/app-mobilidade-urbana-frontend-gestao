import { test, expect } from '@playwright/test'
import { pdfFile } from '../helpers/pdf.mjs'
import { tiposDocumento } from '../fixtures/tipos-documento.mjs'
import { motivosReprovacao } from '../fixtures/motivos-reprovacao.mjs'
import { readFile } from 'node:fs/promises'

const user = {
  id: 42,
  name: 'Pessoa de teste',
  email: 'teste@example.com',
  cpf: '01149897295',
  telefone: '69999999999',
  status: 'ativo',
}
const motorista = { id: 7, user_id: user.id, user, status: 'pendente' }
const paginated = (data) => ({
  data,
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: data.length,
})
const cnh = pdfFile([
  'NOME: JOAO DA SILVA',
  'CPF: 52998224725',
  'DATA NASCIMENTO: 20/05/1990',
  'NUMERO DE REGISTRO: 00024681357',
  'CATEGORIA: AD',
  'PRIMEIRA HABILITACAO: 10/06/2008',
  'DATA EMISSAO: 15/01/2026',
  'VALIDADE: 15/01/2036',
  'EAR: Nao',
  'OBSERVACOES: A, B',
])

async function fotoCnh(page, nome, campos, inclinar = false) {
  const base64 = await page.evaluate(
    ({ campos, inclinar }) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1000
      canvas.height = 700
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#000'
      ctx.font = '24px Arial'
      campos.forEach(([label, valor], index) => {
        ctx.fillText(label, 40, 40 + index * 110)
        ctx.fillText(valor, 40, 80 + index * 110)
      })
      if (!inclinar) return canvas.toDataURL('image/png').split(',')[1]
      const foto = document.createElement('canvas')
      foto.width = 1400
      foto.height = 1100
      const contexto = foto.getContext('2d')
      contexto.fillStyle = '#343434'
      contexto.fillRect(0, 0, foto.width, foto.height)
      contexto.translate(700, 550)
      contexto.rotate((3 * Math.PI) / 180)
      contexto.drawImage(canvas, -500, -350)
      return foto.toDataURL('image/png').split(',')[1]
    },
    { campos, inclinar },
  )
  return { name: nome, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

const camposFrente = [
  ['NOME', 'JOAO DA SILVA'],
  ['CPF', '529.982.247-25'],
  ['DATA NASCIMENTO', '20/05/1990'],
  ['NUMERO DE REGISTRO', '00024681357'],
  ['CATEGORIA', 'AD'],
]
const camposVerso = [
  ['1ª HABILITAÇÃO', '10/06/2008'],
  ['DATA EMISSAO', '15/01/2026'],
  ['VALIDADE', '15/01/2036'],
  ['OBSERVACOES', 'EAR'],
]

test('CNH mantém arquivo e campos ao clicar fora ou pressionar Escape', async ({ page }) => {
  const dialog = page.locator('.documento-dialog')
  await dialog.locator('input[type=file]').setInputFiles(cnh)
  await expect(dialog.getByRole('status')).toContainText('10 campos preenchidos')
  await dialog.getByLabel('Nome na CNH', { exact: true }).fill('NOME CONFERIDO')
  await page.mouse.click(5, 5)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Nome na CNH', { exact: true })).toHaveValue('NOME CONFERIDO')
  await expect(dialog.getByLabel('Número de registro', { exact: true })).toHaveValue('00024681357')
  expect(await dialog.locator('input[type=file]').evaluate((input) => input.files.length)).toBe(1)
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(dialog).not.toBeVisible()
})

test('trocar o verso programaticamente durante a leitura reutiliza a frente pronta e preserva edição manual', async ({
  page,
}) => {
  test.setTimeout(120000)
  const erros = []
  page.on('pageerror', (error) => erros.push(error.message))
  await page.evaluate(() => {
    const WorkerOriginal = window.Worker
    window.preparacoesCnh = 0
    window.versoCnhBloqueado = false
    window.Worker = class extends WorkerOriginal {
      constructor(url, options) {
        super(url, options)
        this.preparadorCnh = String(url).includes('preparar-cnh.worker.js')
      }
      postMessage(message, ...args) {
        if (this.preparadorCnh && message?.tipo === 'preparar') {
          window.preparacoesCnh++
          if (window.preparacoesCnh === 2) {
            window.versoCnhBloqueado = true
            return
          }
        }
        super.postMessage(message, ...args)
      }
    }
  })
  const dialog = page.locator('.documento-dialog')
  await dialog.getByLabel('Nome na CNH', { exact: true }).fill('NOME CONFERIDO')
  await dialog.getByRole('button', { name: 'Fotos: frente e verso', exact: true }).click()
  const inputs = dialog.locator('input[type=file]')
  await inputs.nth(0).setInputFiles(await fotoCnh(page, 'frente.png', camposFrente, true))
  await inputs.nth(1).setInputFiles(await fotoCnh(page, 'verso.png', camposVerso))
  await expect
    .poll(() => page.evaluate(() => window.versoCnhBloqueado), { timeout: 60000 })
    .toBe(true)
  const novoVerso = camposVerso.map(([label, valor]) => [
    label,
    label === 'VALIDADE' ? '15/01/2038' : valor,
  ])
  await inputs.nth(1).setInputFiles(await fotoCnh(page, 'verso-corrigido.png', novoVerso))
  await expect(dialog.getByRole('group', { name: 'Campos da CNH' })).toHaveAttribute(
    'aria-busy',
    'false',
    { timeout: 60000 },
  )
  await expect(dialog.getByRole('status')).toContainText('9 campos preenchidos')
  await expect(dialog.getByLabel('Nome na CNH', { exact: true })).toHaveValue('NOME CONFERIDO')
  await expect(dialog.getByLabel('CPF', { exact: true })).toHaveValue('529.982.247-25')
  await expect(dialog.getByLabel('Número de registro', { exact: true })).toHaveValue('00024681357')
  await expect(dialog.getByLabel('Validade da CNH', { exact: true })).toHaveValue('2038-01-15')
  expect(await page.evaluate(() => window.preparacoesCnh)).toBe(3)
  expect(erros).toEqual([])
})

test('exige frente e verso, le as duas fotos com OCR e envia uma unica CNH', async ({ page }) => {
  test.setTimeout(120000)
  const erros = []
  page.on('pageerror', (erro) => erros.push(erro.message))
  const dialog = page.locator('.documento-dialog')
  await dialog.getByRole('button', { name: 'Fotos: frente e verso', exact: true }).click()
  const inputs = dialog.locator('input[type=file]')
  await expect(inputs).toHaveCount(2)
  const frente = await fotoCnh(page, 'frente.png', camposFrente, true)
  const verso = await fotoCnh(page, 'verso.png', camposVerso)
  await inputs.nth(0).setInputFiles(frente)
  await expect(dialog.getByRole('button', { name: 'Enviar', exact: true })).toBeDisabled()
  await expect(
    dialog.getByRole('img', { name: 'Prévia da CNH: frente', exact: true }),
  ).toBeVisible()
  await inputs.nth(1).setInputFiles(verso)
  const group = dialog.getByRole('group', { name: 'Campos da CNH' })
  await expect(group).toHaveAttribute('aria-busy', 'true')
  await expect(group.locator('.q-spinner')).toHaveCount(1)
  await expect(dialog.getByLabel('Nome na CNH', { exact: true })).toBeDisabled()
  await expect(inputs.nth(0)).toBeDisabled()
  await expect(inputs.nth(1)).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'PDF da CNH', exact: true })).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'Fotos: frente e verso', exact: true }),
  ).toBeDisabled()
  await dialog.getByRole('tab', { name: 'Verso', exact: true }).click()
  await expect(dialog.getByRole('img', { name: 'Prévia da CNH: verso', exact: true })).toBeVisible()
  await expect(group).toHaveAttribute('aria-busy', 'false', { timeout: 60000 })
  await expect(dialog.getByRole('status')).toContainText(
    '10 campos preenchidos a partir das fotos',
    {
      timeout: 5000,
    },
  )
  await expect(group).toHaveAttribute('aria-busy', 'false')
  await expect(inputs.nth(0)).toBeEnabled()
  await expect(inputs.nth(1)).toBeEnabled()
  await expect(dialog.getByRole('button', { name: 'PDF da CNH', exact: true })).toBeEnabled()
  await expect(
    dialog.getByRole('button', { name: 'Fotos: frente e verso', exact: true }),
  ).toBeEnabled()
  await expect(dialog.getByLabel('Nome na CNH', { exact: true })).toHaveValue('JOAO DA SILVA')
  await expect(dialog.getByLabel('CPF', { exact: true })).toHaveValue('529.982.247-25')
  await expect(dialog.getByLabel('Número de registro', { exact: true })).toHaveValue('00024681357')
  await expect(dialog.getByLabel('Primeira habilitação', { exact: true })).toHaveValue('2008-06-10')
  await expect(dialog.getByLabel('Validade da CNH', { exact: true })).toHaveValue('2036-01-15')
  await expect(dialog.getByLabel('Observações da CNH', { exact: true })).toHaveValue('EAR')
  const enviado = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/motorista-documentos'),
  )
  await dialog.getByRole('button', { name: 'Enviar', exact: true }).click()
  const corpo = (await enviado).postData()
  expect(corpo).toContain('name="arquivo"; filename="frente.png"')
  expect(corpo).toContain('name="arquivo_verso"; filename="verso.png"')
  expect(corpo).toContain('name="tipo_documento"\r\n\r\ncnh')
  expect(corpo).toContain('name="cnh[ear]"\r\n\r\n1')
  await expect(dialog).not.toBeVisible()
  expect(erros).toEqual([])
})

test('libera preenchimento manual quando o tratamento das fotos falha', async ({ page }) => {
  await page.route('**/ocr/opencv.js*', (route) => route.abort())
  const dialog = page.locator('.documento-dialog')
  await dialog.getByRole('button', { name: 'Fotos: frente e verso', exact: true }).click()
  const inputs = dialog.locator('input[type=file]')
  await inputs.nth(0).setInputFiles(await fotoCnh(page, 'frente.png', camposFrente))
  await inputs.nth(1).setInputFiles(await fotoCnh(page, 'verso.png', camposVerso))
  await expect(dialog.getByRole('status')).toContainText('Não foi possível preparar as fotos')
  await expect(dialog.getByRole('group', { name: 'Campos da CNH' })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await expect(dialog.getByLabel('Nome na CNH', { exact: true })).toBeEnabled()
  await expect(inputs.nth(0)).toBeEnabled()
  await expect(inputs.nth(1)).toBeEnabled()
  await expect(dialog.getByRole('button', { name: 'PDF da CNH', exact: true })).toBeEnabled()
  await expect(dialog.getByRole('button', { name: 'Enviar', exact: true })).toBeEnabled()
})

test('preenche frente e verso reais sem usar as legendas como dados', async ({ page }) => {
  test.skip(
    !process.env.CNH_FRENTE_PATH || !process.env.CNH_VERSO_PATH,
    'Informe CNH_FRENTE_PATH e CNH_VERSO_PATH para validar fotos locais.',
  )
  test.setTimeout(120000)
  const dialog = page.locator('.documento-dialog')
  await dialog.getByRole('button', { name: 'Fotos: frente e verso', exact: true }).click()
  const inputs = dialog.locator('input[type=file]')
  await inputs.nth(0).setInputFiles(process.env.CNH_FRENTE_PATH)
  await inputs.nth(1).setInputFiles(process.env.CNH_VERSO_PATH)
  await expect(dialog.getByRole('group', { name: 'Campos da CNH' })).toHaveAttribute(
    'aria-busy',
    'false',
    { timeout: 110000 },
  )
  await expect(dialog.getByRole('status')).toContainText('campos preenchidos a partir das fotos')
  if (process.env.CNH_FOTOS_EXPECTED_COUNT) {
    await expect(dialog.getByRole('status')).toContainText(
      `${process.env.CNH_FOTOS_EXPECTED_COUNT} campos preenchidos`,
    )
  }
  await expect(dialog.getByLabel('Nome na CNH', { exact: true })).toHaveValue(
    /^[\p{L}][\p{L}\s.'’-]{2,254}$/u,
  )
  await expect(dialog.getByLabel('CPF', { exact: true })).toHaveValue(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)
  for (const [label, value] of Object.entries(
    JSON.parse(process.env.CNH_FOTOS_EXPECTED_FIELDS || '{}'),
  )) {
    await expect(dialog.getByLabel(label, { exact: true })).toHaveValue(value)
  }
})

test('bloqueia arquivos e formato durante o OCR e libera a troca por PDF ao concluir', async ({
  page,
}) => {
  test.setTimeout(120000)
  const dialog = page.locator('.documento-dialog')
  await dialog.getByLabel('Nome na CNH', { exact: true }).fill('NOME CONFERIDO')
  await dialog.getByRole('button', { name: 'Fotos: frente e verso', exact: true }).click()
  let liberar
  const aguardar = new Promise((resolve) => {
    liberar = resolve
  })
  await page.route('**/ocr/por.traineddata.gz', async (route) => {
    await aguardar
    await route.continue().catch(() => {})
  })
  try {
    const inputs = dialog.locator('input[type=file]')
    await inputs.nth(0).setInputFiles(await fotoCnh(page, 'frente.png', camposFrente))
    await inputs.nth(1).setInputFiles(await fotoCnh(page, 'verso.png', camposVerso))
    await expect(dialog.getByRole('group', { name: 'Campos da CNH' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    await expect(inputs.nth(0)).toBeDisabled()
    await expect(inputs.nth(1)).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'PDF da CNH', exact: true })).toBeDisabled()
    await expect(
      dialog.getByRole('button', { name: 'Fotos: frente e verso', exact: true }),
    ).toBeDisabled()
    await expect(dialog.locator('.q-field__focusable-action')).toHaveCount(0)
    await expect(dialog.getByLabel('Nome na CNH', { exact: true })).toHaveValue('NOME CONFERIDO')
  } finally {
    liberar()
  }
  await expect(dialog.getByRole('group', { name: 'Campos da CNH' })).toHaveAttribute(
    'aria-busy',
    'false',
    { timeout: 60000 },
  )
  await dialog.getByRole('button', { name: 'PDF da CNH', exact: true }).click()
  await expect(dialog.locator('input[type=file]')).toHaveCount(1)
  await expect(dialog.locator('input[type=file]')).toBeEnabled()
  expect(await dialog.locator('input[type=file]').evaluate((input) => input.files.length)).toBe(0)
  await expect(dialog.getByRole('img')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Enviar', exact: true })).toBeDisabled()
  await dialog.locator('input[type=file]').setInputFiles(cnh)
  await expect(dialog.getByRole('status')).toContainText('9 campos preenchidos')
  await expect(dialog.getByLabel('Nome na CNH', { exact: true })).toHaveValue('NOME CONFERIDO')
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'token-de-teste'))
  await page.route('**/*', async (route) => {
    const request = route.request()
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    if (!['xhr', 'fetch'].includes(request.resourceType())) {
      if (new URL(request.url()).origin === 'http://127.0.0.1:18789') await route.continue()
      else await route.abort()
      return
    }
    const url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:18789' && /^\/(?:assets|ocr|pdfjs)\//.test(url.pathname)) {
      await route.continue()
      return
    }
    const endpoint = url.pathname.replace(/^\/api/, '')
    let data
    if (endpoint === '/usuario-logado') data = { id: 90, name: 'Operador', status: 'ativo' }
    else if (endpoint === '/motoristas') data = paginated([motorista])
    else if (endpoint === '/motoristas/7') data = motorista
    else if (endpoint === '/motorista-documentos/tipos') data = { data: tiposDocumento }
    else if (endpoint === '/motorista-documentos/motivos-reprovacao')
      data = { data: motivosReprovacao }
    else if (endpoint === '/motorista-documentos/7/resumo')
      data = {
        data: tiposDocumento.map((tipo) => ({ ...tipo, id: null, status: null, url: null })),
      }
    else if (endpoint === '/motorista-documentos' && request.method() === 'POST') {
      data = {
        message: 'Arquivo enviado com sucesso',
        data: {
          id: 100,
          motorista_id: 7,
          tipo_documento: request.postData().match(/name="tipo_documento"\r\n\r\n([a-z_]+)/)?.[1],
          status: 'em_analise',
        },
      }
    } else {
      await route.abort()
      return
    }
    await route.fulfill({ status: request.method() === 'POST' ? 201 : 200, headers, json: data })
  })
  await page.goto('/motoristas')
  await page
    .locator('button')
    .filter({ has: page.locator('.q-icon', { hasText: /^list_alt$/ }) })
    .click()
  await page
    .locator('.q-dialog .q-icon.cursor-pointer')
    .filter({ hasText: /^upload$/ })
    .first()
    .click()
  await expect(page.locator('.documento-dialog input[type=date]').first()).toBeEnabled()
  await expect(page.getByLabel('Número da CNH', { exact: true })).toHaveCount(0)
})

async function reabrirDocumentos(page) {
  const upload = page.locator('.documento-dialog')
  await upload.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(upload).not.toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.documentos-usuario-dialog')).not.toBeVisible()
  await page
    .locator('button')
    .filter({ has: page.locator('.q-icon', { hasText: /^list_alt$/ }) })
    .click()
}

async function mockDocumentoEnviado(page, documento) {
  await page.route('**/motorista-documentos/7/resumo', (route) =>
    route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        data: tiposDocumento.map((tipo) => ({
          ...tipo,
          ...(tipo.possui_dados_cnh ? { id: 100, ...documento } : {}),
        })),
      },
    }),
  )
  await reabrirDocumentos(page)
  return page.locator('.documentos-usuario-dialog tr').filter({ hasText: 'CARTEIRA NACIONAL' })
}

for (const status of ['em_analise', 'aprovado', 'reprovado']) {
  test(`exibe ações conforme o status ${status} e mantém acesso ao anexo`, async ({ page }) => {
    const url = 'http://localhost/motorista_documentos_anexos/cnh.pdf'
    const row = await mockDocumentoEnviado(page, { status, url })
    await expect(row.getByLabel('Aprovar documento', { exact: true })).toHaveCount(
      status === 'aprovado' ? 0 : 1,
    )
    await expect(row.getByLabel('Reprovar documento', { exact: true })).toHaveCount(
      status === 'reprovado' ? 0 : 1,
    )
    await expect(row.getByLabel('Visualizar documento', { exact: true })).toHaveCount(0)
    await expect(row.getByRole('button', { name: 'Expandir documento', exact: true })).toHaveCount(
      status === 'em_analise' ? 1 : 0,
    )
    await expect(row.getByLabel('Baixar documento', { exact: true })).toBeEnabled()
    await expect(
      page
        .locator('.documentos-usuario-dialog tr')
        .filter({ hasText: 'SEGURO' })
        .getByLabel('Baixar documento', { exact: true }),
    ).toHaveCount(0)
  })
}

test('aprova um documento reprovado e baixa o PDF com nome e conteúdo originais', async ({
  page,
}) => {
  let status = 'reprovado'
  const url = 'http://localhost/motorista_documentos_anexos/cnh.pdf'
  await page.route('**/motorista-documentos/7/resumo', (route) =>
    route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        data: [
          {
            ...tiposDocumento[0],
            id: 100,
            status,
            url,
            name: 'minha-cnh.pdf',
            mime_type: 'application/pdf',
          },
        ],
      },
    }),
  )
  await page.route('**/mudar-status-documento/100', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fallback()
    expect(route.request().postDataJSON()).toEqual({ status: 'aprovado' })
    status = 'aprovado'
    return route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { message: 'Documento aprovado' },
    })
  })
  await page.route('**/motorista-documentos/100/download?lado=frente', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fallback()
    expect(route.request().headers().authorization).toBe('Bearer token-de-teste')
    return route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentType: 'application/pdf',
      body: cnh.buffer,
    })
  })
  await reabrirDocumentos(page)
  const documentos = page.locator('.documentos-usuario-dialog')
  await documentos.getByLabel('Aprovar documento', { exact: true }).click()
  await page
    .locator('.q-dialog .q-card')
    .filter({ hasText: 'Deseja realmente aprovar o documento?' })
    .getByRole('button', { name: 'Sim', exact: true })
    .click()
  await expect(documentos.getByText('aprovado', { exact: true })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await documentos.getByLabel('Baixar documento', { exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('minha-cnh.pdf')
  expect(await download.failure()).toBeNull()
  expect(await readFile(await download.path())).toEqual(cnh.buffer)
})

test('permite baixar separadamente a frente e o verso da CNH', async ({ page }) => {
  const fotos = {
    frente: await fotoCnh(page, 'frente.png', camposFrente),
    verso: await fotoCnh(page, 'verso.png', camposVerso),
  }
  const frenteUrl = 'http://localhost/motorista_documentos_anexos/frente.png'
  const versoUrl = 'http://localhost/motorista_documentos_anexos/verso.png'
  const row = await mockDocumentoEnviado(page, {
    status: 'reprovado',
    url: frenteUrl,
    name: 'frente.png',
    mime_type: 'image/png',
    verso: { url: versoUrl, name: 'verso.png', mime_type: 'image/png' },
  })
  await expect(row.getByLabel('Visualizar documento', { exact: true })).toHaveCount(0)
  await page.route('**/motorista-documentos/100/download?*', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fallback()
    const lado = new URL(route.request().url()).searchParams.get('lado')
    return route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentType: 'image/png',
      body: fotos[lado].buffer,
    })
  })
  for (const lado of ['frente', 'verso']) {
    await row.getByLabel('Baixar documento', { exact: true }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByText(`Baixar ${lado}`, { exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe(`${lado}.png`)
    expect(await readFile(await download.path())).toEqual(fotos[lado].buffer)
  }
})

test('usa os títulos e a ordem do catálogo da API e aguarda seu carregamento', async ({ page }) => {
  const consultas = []
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().includes('/motorista-documentos/'))
      consultas.push(new URL(request.url()).pathname.replace(/^\/api/, ''))
  })
  const catalogo = [...tiposDocumento]
    .reverse()
    .map((tipo) => ({ ...tipo, titulo: `API: ${tipo.titulo}` }))
  let liberar
  const aguardar = new Promise((resolve) => {
    liberar = resolve
  })
  await page.route('**/motorista-documentos/7/resumo', async (route) => {
    await aguardar
    await route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { data: catalogo },
    })
  })
  await reabrirDocumentos(page)
  const documentos = page.locator('.documentos-usuario-dialog')
  try {
    await expect(documentos.locator('.q-inner-loading').getByRole('status')).toContainText(
      'Carregando documentos',
    )
    await expect(documentos.locator('.q-icon.cursor-pointer')).toHaveCount(0)
    await expect(documentos.locator('.q-table .q-item__label.text-h6')).toHaveCount(0)
  } finally {
    liberar()
  }
  await expect(documentos.locator('.q-table .q-item__label.text-h6')).toHaveText(
    catalogo.map((tipo) => tipo.titulo),
  )
  await expect(documentos.locator('.q-icon.cursor-pointer')).toHaveCount(4)
  expect(consultas).toEqual(['/motorista-documentos/7/resumo'])
})

test('permite tentar novamente quando o catálogo de documentos falha', async ({ page }) => {
  let consultas = 0
  await page.route('**/motorista-documentos/7/resumo', async (route) => {
    consultas++
    await route.fulfill({
      status: consultas === 1 ? 500 : 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: consultas === 1 ? { message: 'Catálogo indisponível' } : { data: tiposDocumento },
    })
  })
  await reabrirDocumentos(page)
  const documentos = page.locator('.documentos-usuario-dialog')
  await expect(documentos.locator('.q-banner')).toContainText(
    'Não foi possível carregar os documentos',
  )
  await expect(documentos.locator('.q-icon.cursor-pointer')).toHaveCount(0)
  await documentos.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(documentos.locator('.q-table .q-item__label.text-h6')).toHaveText(
    tiposDocumento.map((tipo) => tipo.titulo),
  )
  await expect(documentos.locator('.q-banner')).toHaveCount(0)
})

test('exige motivo do enum para reprovar sem enviar observacoes da CNH', async ({ page }) => {
  let reprovado = false
  await page.route('**/motorista-documentos/7/resumo', async (route) => {
    await route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        data: tiposDocumento.map((tipo) => ({
          ...tipo,
          id: tipo.possui_dados_cnh ? 100 : null,
          status: tipo.possui_dados_cnh ? (reprovado ? 'reprovado' : 'em_analise') : null,
          url: null,
        })),
      },
    })
  })
  await page.route('**/mudar-status-documento/100', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'PUT,OPTIONS',
        },
      })
      return
    }
    expect(route.request().postDataJSON()).toEqual({
      status: 'reprovado',
      motivo_reprovacao: 'ilegivel',
    })
    reprovado = true
    await route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { message: 'Status do documento alterado com sucesso' },
    })
  })
  await reabrirDocumentos(page)
  const documentos = page.locator('.documentos-usuario-dialog')
  await documentos
    .locator('button')
    .filter({ has: page.locator('.q-icon', { hasText: /^close$/ }) })
    .click()
  await expect(page.getByLabel('Observação', { exact: true })).toHaveCount(0)
  const rejeicao = page.locator('.reprovar-documento-dialog')
  await rejeicao.getByRole('button', { name: 'Reprovar documento', exact: true }).click()
  await expect(
    rejeicao.getByText('Selecione o motivo da reprovação', { exact: true }),
  ).toBeVisible()
  await rejeicao.getByLabel('Motivo da reprovação', { exact: true }).click()
  await page.getByRole('option', { name: 'Documento ilegível', exact: true }).click()
  await expect(rejeicao.getByLabel('Descreva o motivo da reprovação', { exact: true })).toHaveCount(
    0,
  )
  const enviado = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' && request.url().endsWith('/mudar-status-documento/100'),
  )
  await rejeicao.getByRole('button', { name: 'Reprovar documento', exact: true }).click()
  expect((await enviado).postDataJSON()).toEqual({
    status: 'reprovado',
    motivo_reprovacao: 'ilegivel',
  })
  await expect(documentos.getByText('reprovado', { exact: true })).toBeVisible()
})

test('Outro exige texto e mantém a justificativa quando a API rejeita a alteração', async ({
  page,
}) => {
  const row = await mockDocumentoEnviado(page, { status: 'em_analise' })
  let chamadas = 0
  await page.route('**/mudar-status-documento/100', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fallback()
    chamadas++
    expect(route.request().postDataJSON()).toEqual({
      status: 'reprovado',
      motivo_reprovacao: 'outro',
      descricao_reprovacao: 'Foto com reflexo. Envie uma foto nítida.',
    })
    return route.fulfill({
      status: 422,
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        message: 'Confira a justificativa.',
        errors: { descricao_reprovacao: ['Confira a justificativa.'] },
      },
    })
  })
  await row.getByLabel('Reprovar documento', { exact: true }).click()
  const rejeicao = page.locator('.reprovar-documento-dialog')
  await rejeicao.getByLabel('Motivo da reprovação', { exact: true }).click()
  await page.getByRole('option', { name: 'Outro', exact: true }).click()
  const descricao = rejeicao.getByLabel('Descreva o motivo da reprovação', { exact: true })
  await rejeicao.getByRole('button', { name: 'Reprovar documento', exact: true }).click()
  await expect(
    rejeicao.getByText('Descreva o motivo da reprovação', { exact: true }).last(),
  ).toBeVisible()
  expect(chamadas).toBe(0)
  await descricao.fill('  Foto com reflexo. Envie uma foto nítida.  ')
  await rejeicao.getByRole('button', { name: 'Reprovar documento', exact: true }).click()
  await expect(rejeicao.getByText('Confira a justificativa.', { exact: true })).toBeVisible()
  await expect(descricao).toHaveValue('  Foto com reflexo. Envie uma foto nítida.  ')
  expect(chamadas).toBe(1)
  await rejeicao.getByLabel('Motivo da reprovação', { exact: true }).click()
  await page.getByRole('option', { name: 'Documento vencido', exact: true }).click()
  await expect(descricao).toHaveCount(0)
})

test('recupera o catálogo de motivos após falha e usa os títulos retornados pela API', async ({
  page,
}) => {
  const row = await mockDocumentoEnviado(page, { status: 'aprovado' })
  let chamadas = 0
  await page.route('**/motorista-documentos/motivos-reprovacao', (route) => {
    chamadas++
    return route.fulfill({
      status: chamadas === 1 ? 500 : 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      json:
        chamadas === 1
          ? { message: 'Falha ao consultar' }
          : { data: [{ value: 'ilegivel', label: 'API: Foto ilegível', exige_descricao: false }] },
    })
  })
  await row.getByLabel('Reprovar documento', { exact: true }).click()
  const rejeicao = page.locator('.reprovar-documento-dialog')
  await expect(
    rejeicao.getByRole('button', { name: 'Reprovar documento', exact: true }),
  ).toBeDisabled()
  await rejeicao.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await rejeicao.getByLabel('Motivo da reprovação', { exact: true }).click()
  await expect(page.getByRole('option', { name: 'API: Foto ilegível', exact: true })).toBeVisible()
  expect(chamadas).toBe(2)
})

const dadosCnhSalvos = {
  nome: 'NOME SALVO',
  cpf: '52998224725',
  numero_registro: '00024681357',
  cnh_categoria: 'AD',
  data_nascimento: '1990-05-20',
  primeira_habilitacao: '2008-06-10',
  data_emissao: '2026-01-15',
  cnh_expiracao: '2036-01-15',
  observacao: 'A, B',
  ear: false,
}

for (const [formato, documento] of [
  ['PDF', { url: 'http://localhost/cnh.pdf', mime_type: 'application/pdf' }],
  [
    'fotos',
    {
      url: 'http://localhost/frente.png',
      mime_type: 'image/png',
      verso: { url: 'http://localhost/verso.png' },
    },
  ],
]) {
  test(`expande CNH em análise com dados salvos e prévia de ${formato}`, async ({ page }) => {
    await page.route('**/motoristas/7', (route) =>
      route.fulfill({
        headers: { 'Access-Control-Allow-Origin': '*' },
        json: { ...motorista, ...dadosCnhSalvos },
      }),
    )
    const row = await mockDocumentoEnviado(page, { status: 'em_analise', ...documento })
    await row.getByRole('button', { name: 'Expandir documento', exact: true }).click()
    const upload = page.locator('.documento-dialog')
    await expect(upload.getByLabel('Nome na CNH', { exact: true })).toHaveValue('NOME SALVO')
    await expect(upload.getByLabel('Motivo da reprovação', { exact: true })).toHaveCount(0)
    await expect(
      upload.getByRole('button', { name: 'Remover documento atual', exact: true }),
    ).toBeEnabled()
    if (formato === 'PDF') {
      await expect(upload.locator('iframe')).toHaveAttribute('src', documento.url)
      await expect(upload.locator('.q-file').first()).toContainText('cnh.pdf')
      await expect(
        upload.getByRole('button', { name: 'Fotos: frente e verso', exact: true }),
      ).toBeDisabled()
    } else {
      await expect(
        upload.getByRole('img', { name: 'Prévia da CNH: frente', exact: true }),
      ).toHaveAttribute('src', documento.url)
      await upload.getByRole('tab', { name: 'Verso', exact: true }).click()
      await expect(
        upload.getByRole('img', { name: 'Prévia da CNH: verso', exact: true }),
      ).toHaveAttribute('src', documento.verso.url)
      await expect(upload.getByRole('button', { name: 'PDF da CNH', exact: true })).toBeDisabled()
    }
  })
}

test('reenviar CNH preenche dados salvos, mostra motivo abaixo do EAR e preserva correção manual', async ({
  page,
}) => {
  let reenviado = false
  await page.route('**/motoristas/7', (route) =>
    route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { ...motorista, ...dadosCnhSalvos },
    }),
  )
  await page.route('**/motorista-documentos/7/resumo', (route) =>
    route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        data: [
          {
            ...tiposDocumento[0],
            id: reenviado ? 101 : 100,
            status: reenviado ? 'em_analise' : 'reprovado',
            url: 'http://localhost/motorista_documentos_anexos/cnh.pdf',
            mime_type: 'application/pdf',
            motivo_reprovacao: reenviado ? null : 'outro',
            descricao_reprovacao: reenviado ? null : 'Nome divergente. Confira o documento.',
            motivo_reprovacao_texto: reenviado ? null : 'Nome divergente. Confira o documento.',
          },
        ],
      },
    }),
  )
  await page.route('**/motorista-documentos', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fallback()
    const corpo = route.request().postData()
    expect(corpo).toContain('name="cnh[nome]"\r\n\r\nNOME CORRIGIDO')
    expect(corpo).not.toContain('name="motivo_reprovacao"')
    expect(corpo).not.toContain('name="descricao_reprovacao"')
    reenviado = true
    return route.fulfill({
      status: 201,
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { message: 'Novo envio em análise' },
    })
  })
  await reabrirDocumentos(page)
  const documentos = page.locator('.documentos-usuario-dialog')
  await documentos.getByRole('button', { name: 'Reenviar documento', exact: true }).click()
  const upload = page.locator('.documento-dialog')
  await expect(upload.getByLabel('Nome na CNH', { exact: true })).toHaveValue('NOME SALVO')
  for (const [label, valor] of Object.entries({
    CPF: '529.982.247-25',
    'Número de registro': '00024681357',
    Categoria: 'AD',
    'Data de nascimento': '1990-05-20',
    'Primeira habilitação': '2008-06-10',
    'Data de emissão': '2026-01-15',
    'Validade da CNH': '2036-01-15',
    'Observações da CNH': 'A, B',
  }))
    await expect(upload.getByLabel(label, { exact: true })).toHaveValue(valor)
  await expect(upload.getByLabel('EAR — Exerce atividade remunerada', { exact: true })).toHaveValue(
    'Não',
  )
  const motivo = upload.getByLabel('Motivo da reprovação', { exact: true })
  await expect(motivo).toHaveValue('Nome divergente. Confira o documento.')
  await expect(motivo).toHaveAttribute('readonly', '')
  const ear = await upload
    .getByLabel('EAR — Exerce atividade remunerada', { exact: true })
    .boundingBox()
  const posicao = await motivo.boundingBox()
  expect(posicao.y).toBeGreaterThan(ear.y)
  await expect(upload.locator('iframe')).toHaveAttribute(
    'src',
    'http://localhost/motorista_documentos_anexos/cnh.pdf',
  )
  await expect(upload.getByRole('button', { name: 'PDF da CNH', exact: true })).toBeEnabled()
  await expect(upload.getByRole('button', { name: 'PDF da CNH', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(
    upload.getByRole('button', { name: 'Fotos: frente e verso', exact: true }),
  ).toBeDisabled()
  await expect(upload.getByRole('tab', { name: 'Verso', exact: true })).toHaveCount(0)
  await expect(upload.getByRole('button', { name: 'Enviar', exact: true })).toBeDisabled()
  await upload.getByLabel('Nome na CNH', { exact: true }).fill('NOME CORRIGIDO')
  await expect(upload.locator('.q-file').first()).toContainText('cnh.pdf')
  await upload.getByRole('button', { name: 'Remover documento atual', exact: true }).click()
  await expect(upload.locator('iframe')).toHaveCount(0)
  await expect(
    upload.getByRole('button', { name: 'Fotos: frente e verso', exact: true }),
  ).toBeEnabled()
  await upload.locator('input[type=file]').setInputFiles(cnh)
  await expect(upload.getByRole('group', { name: 'Campos da CNH' })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await expect(upload.getByLabel('Nome na CNH', { exact: true })).toHaveValue('NOME CORRIGIDO')
  await expect(
    upload.getByRole('button', { name: 'Fotos: frente e verso', exact: true }),
  ).toBeEnabled()
  await upload.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(upload).not.toBeVisible()
  await expect(documentos.getByText('em_analise', { exact: true })).toBeVisible()
  await expect(
    documentos.getByRole('button', { name: 'Reenviar documento', exact: true }),
  ).toHaveCount(0)
})

test('reenvio por fotos mostra os dois anexos antigos e motivos padronizados sem carregar arquivos para upload', async ({
  page,
}) => {
  const row = await mockDocumentoEnviado(page, {
    status: 'reprovado',
    url: 'http://localhost/frente.png',
    mime_type: 'image/png',
    motivo_reprovacao_texto: 'Documento ilegível',
    verso: { url: 'http://localhost/verso.png', mime_type: 'image/png' },
  })
  await row.getByRole('button', { name: 'Reenviar documento', exact: true }).click()
  const upload = page.locator('.documento-dialog')
  await expect(upload.locator('input[type=file]')).toHaveCount(2)
  await expect(
    upload.getByRole('button', { name: 'Fotos: frente e verso', exact: true }),
  ).toBeEnabled()
  await expect(
    upload.getByRole('button', { name: 'Fotos: frente e verso', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(upload.getByRole('button', { name: 'PDF da CNH', exact: true })).toBeDisabled()
  await expect(upload.locator('iframe')).toHaveCount(0)
  await expect(
    upload.getByRole('img', { name: 'Prévia da CNH: frente', exact: true }),
  ).toHaveAttribute('src', 'http://localhost/frente.png')
  await upload.getByRole('tab', { name: 'Verso', exact: true }).click()
  await expect(
    upload.getByRole('img', { name: 'Prévia da CNH: verso', exact: true }),
  ).toHaveAttribute('src', 'http://localhost/verso.png')
  await expect(upload.getByLabel('Motivo da reprovação', { exact: true })).toHaveValue(
    'Documento ilegível',
  )
  expect(
    await upload
      .locator('input[type=file]')
      .evaluateAll((inputs) => inputs.map((input) => input.files.length)),
  ).toEqual([0, 0])
  await expect(upload.getByRole('button', { name: 'Enviar', exact: true })).toBeDisabled()
  await expect(upload.locator('.q-file').nth(0)).toContainText('frente.png')
  await expect(upload.locator('.q-file').nth(1)).toContainText('verso.png')
  await upload.getByRole('button', { name: 'Remover documento atual', exact: true }).click()
  await expect(upload.getByRole('img')).toHaveCount(0)
  await expect(upload.getByRole('button', { name: 'PDF da CNH', exact: true })).toBeEnabled()
  await upload.getByRole('button', { name: 'PDF da CNH', exact: true }).click()
  await expect(upload.getByRole('tab')).toHaveCount(0)
  await expect(upload.locator('input[type=file]')).toHaveCount(1)
  await upload.locator('input[type=file]').setInputFiles(cnh)
  await expect(upload.getByRole('status')).toContainText('10 campos preenchidos')
  const enviado = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/motorista-documentos'),
  )
  await upload.getByRole('button', { name: 'Enviar', exact: true }).click()
  const corpo = (await enviado).postData()
  expect(corpo).toContain(`name="arquivo"; filename="${cnh.name}"`)
  expect(corpo).not.toContain('name="arquivo_verso"')
  await expect(upload).not.toBeVisible()
})

test('remover o PDF permite trocar por fotos sem perder dados e cancelar restaura o anexo salvo', async ({
  page,
}) => {
  const mutacoes = []
  page.on('request', (request) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method())) mutacoes.push(request.url())
  })
  await page.route('**/motoristas/7', (route) =>
    route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { ...motorista, ...dadosCnhSalvos },
    }),
  )
  const row = await mockDocumentoEnviado(page, {
    status: 'reprovado',
    url: 'http://localhost/cnh-antiga.pdf',
    name: 'CNH atual.pdf',
    mime_type: 'application/pdf',
  })
  await row.getByRole('button', { name: 'Reenviar documento', exact: true }).click()
  const upload = page.locator('.documento-dialog')
  await expect(upload.getByLabel('Nome na CNH', { exact: true })).toHaveValue('NOME SALVO')
  await expect(upload.locator('.q-file').first()).toContainText('CNH atual.pdf')
  await expect(upload.locator('.q-field--error')).toHaveCount(0)
  await upload.getByLabel('Nome na CNH', { exact: true }).fill('NOME CONFERIDO')
  await upload.getByRole('button', { name: 'Remover documento atual', exact: true }).click()
  await expect(upload.locator('iframe')).toHaveCount(0)
  await expect(upload.getByRole('button', { name: 'Abrir arquivo', exact: true })).toHaveCount(0)
  await upload.getByRole('button', { name: 'Fotos: frente e verso', exact: true }).click()
  await expect(upload.locator('input[type=file]')).toHaveCount(2)
  await expect(upload.getByLabel('Nome na CNH', { exact: true })).toHaveValue('NOME CONFERIDO')
  await expect(upload.getByLabel('Número de registro', { exact: true })).toHaveValue('00024681357')
  await expect(upload.getByRole('button', { name: 'Enviar', exact: true })).toBeDisabled()
  await upload.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(upload).not.toBeVisible()
  await row.getByRole('button', { name: 'Reenviar documento', exact: true }).click()
  await expect(upload.locator('iframe')).toHaveAttribute('src', 'http://localhost/cnh-antiga.pdf')
  await expect(upload.locator('.q-file').first()).toContainText('CNH atual.pdf')
  await expect(
    upload.getByRole('button', { name: 'Fotos: frente e verso', exact: true }),
  ).toBeDisabled()
  expect(mutacoes).toEqual([])
})

for (const [identificacao, documento] of [
  ['MIME', { url: 'http://localhost/anexo/100', mime_type: 'application/pdf' }],
  ['extensão na URL', { url: 'http://localhost/cnh.PDF?download=1' }],
  ['nome do arquivo', { url: 'http://localhost/anexo/100', name: 'cnh.pdf' }],
]) {
  test(`reenvio reconhece PDF por ${identificacao} e bloqueia frente e verso`, async ({ page }) => {
    const row = await mockDocumentoEnviado(page, { status: 'reprovado', ...documento })
    await row.getByRole('button', { name: 'Reenviar documento', exact: true }).click()
    const upload = page.locator('.documento-dialog')
    await expect(upload.getByLabel('Nome na CNH', { exact: true })).toBeEnabled()
    await expect(upload.getByRole('button', { name: 'PDF da CNH', exact: true })).toBeEnabled()
    await expect(
      upload.getByRole('button', { name: 'Fotos: frente e verso', exact: true }),
    ).toBeDisabled()
    await expect(upload.locator('iframe')).toHaveAttribute('src', documento.url)
    await expect(upload.locator('input[type=file]')).toHaveCount(1)
    await expect(upload.getByRole('tab')).toHaveCount(0)
  })
}

test('reenvio sem anexo salvo permite escolher PDF ou fotos', async ({ page }) => {
  const row = await mockDocumentoEnviado(page, { status: 'reprovado', url: null })
  await row.getByRole('button', { name: 'Reenviar documento', exact: true }).click()
  const upload = page.locator('.documento-dialog')
  await expect(upload.getByRole('button', { name: 'PDF da CNH', exact: true })).toBeEnabled()
  await expect(
    upload.getByRole('button', { name: 'Fotos: frente e verso', exact: true }),
  ).toBeEnabled()
  await upload.getByRole('button', { name: 'Fotos: frente e verso', exact: true }).click()
  await expect(upload.locator('input[type=file]')).toHaveCount(2)
  await upload.getByRole('button', { name: 'PDF da CNH', exact: true }).click()
  await expect(upload.locator('input[type=file]')).toHaveCount(1)
})

test('reenvio de outros documentos também mostra motivo apenas para leitura', async ({ page }) => {
  await page.route('**/motorista-documentos/7/resumo', (route) =>
    route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        data: [
          {
            ...tiposDocumento[1],
            id: 100,
            status: 'reprovado',
            motivo_reprovacao_texto: 'Documento vencido',
          },
        ],
      },
    }),
  )
  await reabrirDocumentos(page)
  await page
    .locator('.documentos-usuario-dialog')
    .getByRole('button', { name: 'Reenviar documento', exact: true })
    .click()
  const upload = page.locator('.documento-dialog')
  await expect(upload.getByLabel('Motivo da reprovação', { exact: true })).toHaveValue(
    'Documento vencido',
  )
  await expect(upload.getByLabel('Motivo da reprovação', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  )
  await expect(upload.getByRole('group', { name: 'Campos da CNH' })).toHaveCount(0)
})

for (const tipo of tiposDocumento.filter((item) => !item.possui_dados_cnh)) {
  test(`envia ${tipo.titulo} com o valor do enum retornado pela API`, async ({ page }) => {
    const upload = page.locator('.documento-dialog')
    await upload.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await expect(upload).not.toBeVisible()
    await page
      .locator('.documentos-usuario-dialog tr')
      .filter({ hasText: tipo.titulo })
      .locator('.q-icon.cursor-pointer')
      .click()
    await expect(upload.getByRole('group', { name: 'Campos da CNH' })).toHaveCount(0)
    await upload.locator('input[type=file]').setInputFiles(cnh)
    const enviado = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/motorista-documentos'),
    )
    await upload.getByRole('button', { name: 'Enviar', exact: true }).click()
    const request = await enviado
    expect(request.postData()).toContain(`name="tipo_documento"\r\n\r\n${tipo.tipo_documento}`)
    expect(request.postData()).not.toContain('name="cnh[')
    await expect(upload).not.toBeVisible()
  })
}

test('preenche os campos, exibe a previa e envia os dados no motorista correto', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const dialog = page.locator('.documento-dialog')
  await dialog.locator('input[type=file]').setInputFiles(cnh)
  await expect(dialog.getByRole('status')).toContainText('10 campos preenchidos')
  await expect(dialog.getByLabel('Nome na CNH', { exact: true })).toHaveValue('JOAO DA SILVA')
  await expect(dialog.getByLabel('CPF', { exact: true })).toHaveValue('529.982.247-25')
  await expect(dialog.getByLabel('Número de registro', { exact: true })).toHaveValue('00024681357')
  await expect(dialog.getByLabel('Data de emissão', { exact: true })).toHaveValue('2026-01-15')
  await expect(dialog.getByLabel('Observações da CNH', { exact: true })).toHaveValue('A, B')
  await expect(dialog.locator('iframe')).toHaveAttribute('src', /^blob:/)
  const [left, right] = await Promise.all([
    dialog.locator('.dados-documento').boundingBox(),
    dialog.locator('.previa-documento').boundingBox(),
  ])
  expect(left.x + left.width).toBeLessThanOrEqual(right.x + 1)
  const sent = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/motorista-documentos'),
  )
  await dialog.getByRole('button', { name: 'Enviar', exact: true }).click()
  const request = await sent
  expect(request.postData()).toContain('name="motorista_id"\r\n\r\n7')
  expect(request.postData()).toContain('name="tipo_documento"\r\n\r\ncnh')
  expect(request.postData()).toContain('name="cnh[numero_registro]"\r\n\r\n00024681357')
  expect(request.postData()).not.toContain('cnh[cnh_numero]')
  expect(request.postData()).toContain('name="cnh[observacao]"\r\n\r\nA, B')
  await expect(dialog).not.toBeVisible()
  expect(errors).toEqual([])
})

test('troca o PDF e preserva o nome editado manualmente', async ({ page }) => {
  const dialog = page.locator('.documento-dialog')
  const file = dialog.locator('input[type=file]')
  await file.setInputFiles(cnh)
  await expect(dialog.getByRole('status')).toContainText('10 campos preenchidos')
  await dialog.getByLabel('Nome na CNH', { exact: true }).fill('NOME CONFERIDO')
  await file.setInputFiles(pdfFile(['NOME: OUTRA PESSOA', 'NUMERO DE REGISTRO: 00033333333']))
  await expect(dialog.getByRole('status')).toContainText('1 campo preenchido')
  await expect(dialog.getByLabel('Nome na CNH', { exact: true })).toHaveValue('NOME CONFERIDO')
  await expect(dialog.getByLabel('Número de registro', { exact: true })).toHaveValue('00033333333')
  await expect(dialog.getByLabel('CPF', { exact: true })).toHaveValue('')
  await dialog.locator('.q-file [aria-label="Clear"]').click()
  await expect(dialog.locator('iframe')).toHaveCount(0)
  await expect(dialog.getByRole('status')).toHaveCount(0)
})

test('carrega observações salvas com um único loading e bloqueia todo o grupo', async ({
  page,
}) => {
  const dialog = page.locator('.documento-dialog')
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  let liberar
  const aguardar = new Promise((resolve) => {
    liberar = resolve
  })
  await page.route('**/motoristas/7', async (route) => {
    await aguardar
    await route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { ...motorista, observacao: 'EAR\nA, B' },
    })
  })
  await page
    .locator('.q-dialog .q-icon.cursor-pointer')
    .filter({ hasText: /^upload$/ })
    .first()
    .click()
  const group = dialog.getByRole('group', { name: 'Campos da CNH' })
  try {
    await expect(group).toHaveAttribute('aria-busy', 'true')
    await expect(group.getByRole('status')).toContainText('Carregando dados da CNH')
    await expect(group.locator('.q-spinner')).toHaveCount(1)
    for (const campo of await group.locator('input, textarea').all())
      await expect(campo).toBeDisabled()
  } finally {
    liberar()
  }
  await expect(group).toHaveAttribute('aria-busy', 'false')
  await expect(group.locator('.q-spinner')).toHaveCount(0)
  await expect(dialog.getByLabel('Observações da CNH', { exact: true })).toHaveValue('EAR\nA, B')
  for (const campo of await group.locator('input, textarea').all())
    await expect(campo).toBeEnabled()
})

test('explica o preenchimento manual para PDF sem texto ou invalido', async ({ page }) => {
  const dialog = page.locator('.documento-dialog')
  await dialog.locator('input[type=file]').setInputFiles(pdfFile())
  await expect(dialog.getByRole('status')).toContainText('não tem texto disponível')
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'invalido.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('PDF invalido'),
  })
  await expect(dialog.getByRole('status')).toContainText('Não foi possível ler os dados')
  for (const campo of await dialog
    .getByRole('group', { name: 'Campos da CNH' })
    .locator('input, textarea')
    .all())
    await expect(campo).toBeEnabled()
  await expect(dialog.getByRole('button', { name: 'Enviar', exact: true })).toBeEnabled()
})

test('diferencia arquivo grande e formato incorreto, aceitando selecionar novamente um PDF valido', async ({
  page,
}) => {
  const file = page.locator('.documento-dialog input[type=file]')
  await file.setInputFiles({
    name: 'grande.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(2097153),
  })
  await expect(page.locator('.q-notification')).toContainText('ultrapassa o limite de 2 MB')
  await file.setInputFiles({
    name: 'arquivo.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('texto'),
  })
  await expect(
    page.locator('.q-notification').filter({ hasText: 'Formato não permitido' }),
  ).toBeVisible()
  await file.setInputFiles(cnh)
  await expect(page.locator('.documento-dialog').getByRole('status')).toContainText(
    '10 campos preenchidos',
  )
  await file.setInputFiles(cnh)
  await expect(page.locator('.documento-dialog').getByRole('status')).toContainText(
    '10 campos preenchidos',
  )
})

test('empilha os paineis no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const dialog = page.locator('.documento-dialog')
  await dialog.locator('input[type=file]').setInputFiles(cnh)
  await expect(dialog.getByRole('status')).toContainText('10 campos preenchidos')
  const [left, right, box] = await Promise.all([
    dialog.locator('.dados-documento').boundingBox(),
    dialog.locator('.previa-documento').boundingBox(),
    dialog.boundingBox(),
  ])
  expect(right.y).toBeGreaterThanOrEqual(left.y + left.height - 1)
  expect(box.width).toBeLessThanOrEqual(390)
})

test('preenche o PDF real de CNH-e com OCR da imagem', async ({ page }) => {
  test.skip(!process.env.CNH_PDF_PATH, 'Defina CNH_PDF_PATH para validar o documento local.')
  test.setTimeout(120000)
  const dialog = page.locator('.documento-dialog')
  await dialog.locator('input[type=file]').setInputFiles(process.env.CNH_PDF_PATH)
  await expect(dialog.getByRole('status')).toContainText('por leitura da imagem', {
    timeout: 110000,
  })
  await expect(dialog.getByLabel('Nome na CNH', { exact: true })).toHaveValue(
    /^[\p{L}][\p{L}\s.'’-]{2,254}$/u,
  )
  await expect(dialog.getByLabel('CPF', { exact: true })).toHaveValue(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)
  await expect(dialog.getByLabel('Número de registro', { exact: true })).toHaveValue(/^\d{11}$/)
  for (const label of [
    'Data de nascimento',
    'Data de emissão',
    'Primeira habilitação',
    'Validade da CNH',
  ]) {
    await expect(dialog.getByLabel(label, { exact: true })).toHaveValue(/^\d{4}-\d{2}-\d{2}$/)
  }
  await expect(dialog.getByLabel('Categoria', { exact: true })).toHaveValue(/^(?:A[B-E]?|[B-E])$/)
  for (const [label, value] of Object.entries(
    JSON.parse(process.env.CNH_EXPECTED_FIELDS || '{}'),
  )) {
    await expect(dialog.getByLabel(label, { exact: true })).toHaveValue(value)
  }
  await expect(dialog.locator('iframe')).toHaveAttribute('src', /^blob:/)
  await expect(page.locator('.q-notification')).toHaveCount(0)
})

test('cancela o OCR ao trocar o PDF e preserva a edição manual', async ({ page }) => {
  test.skip(!process.env.CNH_PDF_PATH, 'Defina CNH_PDF_PATH para validar o documento local.')
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const dialog = page.locator('.documento-dialog')
  const file = dialog.locator('input[type=file]')
  await dialog.getByLabel('Nome na CNH', { exact: true }).fill('NOME CONFERIDO')
  await file.setInputFiles(process.env.CNH_PDF_PATH)
  await expect(dialog.getByRole('status')).toContainText(/Preparando a leitura|Lendo a imagem/)
  const group = dialog.getByRole('group', { name: 'Campos da CNH' })
  await expect(group).toHaveAttribute('aria-busy', 'true')
  await expect(group.locator('.q-spinner')).toHaveCount(1)
  for (const campo of await group.locator('input, textarea').all())
    await expect(campo).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Enviar', exact: true })).toBeDisabled()
  await file.setInputFiles(cnh)
  await expect(dialog.getByRole('status')).toContainText('9 campos preenchidos')
  await expect(group).toHaveAttribute('aria-busy', 'false')
  for (const campo of await group.locator('input, textarea').all())
    await expect(campo).toBeEnabled()
  await expect(dialog.getByLabel('Nome na CNH', { exact: true })).toHaveValue('NOME CONFERIDO')
  await expect(dialog.getByLabel('CPF', { exact: true })).toHaveValue('529.982.247-25')
  await expect(dialog.getByLabel('Número de registro', { exact: true })).toHaveValue('00024681357')
  expect(errors).toEqual([])
})
