const normalizar = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim()
const identificador = (value) => normalizar(value).replace(/[^A-Z0-9]/g, '')
const texto = (value) => value.trim().replace(/\s+/g, ' ') || undefined
function data(value) {
  const match = value.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/)
  if (!match) return
  const iso = `${match[3]}-${match[2]}-${match[1]}`
  const date = new Date(`${iso}T00:00:00Z`)
  if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso) return iso
}
const ano = (value) => value.match(/\b(?:19|20)\d{2}\b/)?.[0]
const numeroDocumento = (value) =>
  value
    .trim()
    .replace(/[.\s/-]/g, '')
    .match(/^\d{1,20}$/)?.[0]
const campos = [
  ['placa', /^PLACA$/, (v) => identificador(v).match(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/)?.[0]],
  ['renavam', /^(?:CODIGO\s+)?RENAVAM$/, (v) => v.replace(/\D/g, '').match(/^\d{11}$/)?.[0]],
  ['numero_crv', /^(?:NUMERO|N[º°o.]?)\s+(?:DO\s+)?CRV$/i, numeroDocumento],
  ['codigo_seguranca', /^CODIGO DE SEGURANCA(?: DO (?:CLA|CRV|CRLV))?$/, numeroDocumento],
  ['chassi', /^CHASSI$/, (v) => identificador(v).match(/^[A-HJ-NPR-Z0-9]{17}$/)?.[0]],
  ['exercicio', /^EXERCICIO$/, ano],
  ['data_emissao', /^(?:DATA?|DATA (?:DE )?EMISSAO)$/, data],
  ['nome_proprietario', /^(?:NOME|NOME (?:DO )?PROPRIETARIO)$/, texto],
  [
    'cpf_cnpj_proprietario',
    /^CPF\s*\/?\s*CNPJ?$/,
    (v) => v.replace(/\D/g, '').match(/^(?:\d{11}|\d{14})$/)?.[0],
  ],
  ['marca_modelo', /^MARCA\s*\/\s*MODELO(?:\s*\/\s*VERSAO)?$/, texto],
  ['cor', /^COR(?: PREDOMINANTE)?$/, texto],
  ['ano_fabricacao', /^ANO FABRICACAO$/, ano],
  ['ano_modelo', /^ANO MODELO$/, ano],
  ['categoria', /^CATEGORIA$/, texto],
  [
    'categoria_veiculo',
    /^ESPECIE\s*\/\s*TIPO$/,
    (v) => {
      const value = normalizar(v)
      if (/\b(?:MOTOCICLETA|MOTONETA|CICLOMOTOR|TRICICLO)\b/.test(value)) return 'moto'
      if (/\b(?:AUTOMOVEL|CAMIONETA|CAMINHONETE|UTILITARIO)\b/.test(value)) return 'carro'
    },
  ],
  ['observacao', /^OBSERVACOES(?: (?:DO )?VEICULO)?$/, texto],
  [
    'uf',
    /^LOCAL$/,
    (v) =>
      normalizar(v).match(
        /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/,
      )?.[1],
  ],
]

function linhas(items) {
  const rows = []
  for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    let row = rows.find(
      (r) =>
        Math.abs(r.y + r.height / 2 - (item.y + item.height / 2)) <=
        Math.max(3, Math.min(item.height, r.height) * 0.75),
    )
    if (!row) rows.push((row = { y: item.y, height: item.height, items: [] }))
    row.items.push(item)
  }
  return rows.sort((a, b) => a.y - b.y)
}

const limitesExtras =
  /^(?:COMBUSTIVEL|CAPACIDADE|POTENCIA\s*\/\s*CILINDRADA|PESO BRUTO TOTAL|MOTOR|CMT|EIXOS|LOTACAO|CARROCERIA|LOCAL|PLACA ANTERIOR\s*\/\s*UF|CAT|DATA DE QUITACAO|DADOS DO SEGURO DPVAT|INFORMACOES DO SEGURO DPVAT|MENSAGENS SENATRAN|DOCUMENTO EMITIDO.*)$/
const rotulo = (value) =>
  normalizar(value)
    .replace(/[.:"'“”|()]/g, '')
    .replace(/\s*\/\s*/g, '/')
    .trim()

function rotulos(items) {
  const reconhecido = (text) =>
    campos.some(([, pattern]) => pattern.test(rotulo(text))) || limitesExtras.test(rotulo(text))
  const encontrados = items.filter((i) => reconhecido(i.text))
  for (const row of linhas(items)) {
    const palavras = row.items.sort((a, b) => a.x - b.x)
    for (let inicio = 0; inicio < palavras.length; inicio++) {
      const grupo = { ...palavras[inicio] }
      for (let fim = inicio + 1; fim < Math.min(palavras.length, inicio + 8); fim++) {
        const proxima = palavras[fim]
        if (proxima.x - (grupo.x + grupo.width) > Math.max(12, row.height * 2)) break
        grupo.text += ' ' + proxima.text
        grupo.width = Math.max(grupo.width, proxima.x + proxima.width - grupo.x)
        const bottom = Math.max(grupo.y + grupo.height, proxima.y + proxima.height)
        grupo.y = Math.min(grupo.y, proxima.y)
        grupo.height = bottom - grupo.y
        if (reconhecido(grupo.text)) encontrados.push({ ...grupo })
      }
    }
  }
  // Use the complete label, rather than its single-word prefix (e.g. COR).
  return encontrados.filter(
    (i, index) =>
      !encontrados.some(
        (j, outro) =>
          outro !== index &&
          j.x <= i.x &&
          j.x + j.width >= i.x + i.width &&
          Math.abs(j.y + j.height / 2 - i.y - i.height / 2) <= Math.max(j.height, i.height) &&
          (j.width > i.width || (j.width === i.width && outro < index)),
      ),
  )
}

export function regioesCrlv(items) {
  const labels = rotulos(items)
  const direitaPagina = Math.max(...items.map((i) => i.x + i.width))
  const inicioDireita = labels.find((i) => rotulo(i.text) === 'CATEGORIA')?.x
  return campos.flatMap(([name, pattern, parse]) =>
    labels
      .filter((i) => pattern.test(rotulo(i.text)))
      .map((label) => {
        const mesmaLinha = labels
          .filter(
            (i) =>
              i.x > label.x + label.width &&
              Math.abs(i.y + i.height / 2 - label.y - label.height / 2) <
                Math.max(label.height, i.height),
          )
          .sort((a, b) => a.x - b.x)[0]
        const limiteColuna =
          inicioDireita && label.x < inicioDireita - 30 ? inicioDireita - 30 : direitaPagina + 5
        const right = Math.min(
          mesmaLinha?.x - 4 || Infinity,
          limiteColuna,
          name === 'numero_crv' ? label.x + Math.max(100, label.width * 2.5) : Infinity,
        )
        // RENAVAM may be recognized without its small "CÓDIGO" prefix.
        const left =
          name === 'renavam'
            ? Math.min(
                label.x,
                ...labels
                  .filter((i) => i.x < label.x && label.x - i.x < label.height * 12)
                  .map((i) => i.x),
              ) - 5
            : label.x - 5
        const next = labels
          .filter((i) => i.y > label.y + label.height && i.x >= left && i.x < right)
          .sort((a, b) => a.y - b.y)[0]
        const top = label.y + label.height
        const bottom = Math.min(
          next?.y ?? Infinity,
          top + label.height * (name === 'observacao' ? 25 : 8),
        )
        return {
          name,
          parse,
          left: Math.max(0, left),
          top,
          width: right - Math.max(0, left),
          height: bottom - top - 1,
        }
      })
      .filter((r) => r.width > 0 && r.height > 0),
  )
}

export function extrairCamposCrlv(pages, conflitos = new Set()) {
  const candidatos = new Map()
  for (const original of pages) {
    const items = original.filter((item) => item.text?.trim() && item.height > 0)
    for (const [name, pattern, parse] of campos) {
      for (const item of items) {
        const colon = item.text.indexOf(':')
        if (colon < 0 || !pattern.test(normalizar(item.text.slice(0, colon)))) continue
        const value = parse(item.text.slice(colon + 1))
        if (value === undefined) continue
        if (!candidatos.has(name)) candidatos.set(name, new Set())
        candidatos.get(name).add(value)
      }
    }
    for (const { name, parse, left, top, width, height } of regioesCrlv(items)) {
      const values = items.filter(
        (i) =>
          i.y >= top &&
          i.y < top + height &&
          i.x >= left &&
          i.x < left + width &&
          (i.confidence === undefined || i.confidence >= 65) &&
          /[\p{L}\d]/u.test(i.text),
      )
      const rows = linhas(values)
      if (name === 'observacao') {
        const value = rows
          .map((row) =>
            texto(
              row.items
                .sort((a, b) => a.x - b.x)
                .map((i) => i.text)
                .join(' '),
            ),
          )
          .filter((v) => v && !/^\*+$/.test(v))
          .join('\n')
        if (value) {
          if (!candidatos.has(name)) candidatos.set(name, new Set())
          candidatos.get(name).add(value)
        }
        continue
      }
      for (const row of rows) {
        const value = parse(
          row.items
            .sort((a, b) => a.x - b.x)
            .map((i) => i.text)
            .join(' '),
        )
        if (value === undefined || value === '*' || value === '***') continue
        if (!candidatos.has(name)) candidatos.set(name, new Set())
        candidatos.get(name).add(value)
        break
      }
    }
    // A UF aparece ao lado de DETRAN ou no local de emissão.
    for (const item of items) {
      const match = normalizar(item.text).match(
        /^(?:DETRAN\s*[-/]\s*|[A-Z]{3}[0-9][A-Z0-9][0-9]{2}\s*\/\s*)([A-Z]{2})$/,
      )
      if (
        match &&
        /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(
          match[1],
        )
      ) {
        if (!candidatos.has('uf')) candidatos.set('uf', new Set())
        candidatos.get('uf').add(match[1])
      }
    }
  }
  for (const [name, values] of candidatos) if (values.size > 1) conflitos.add(name)
  return Object.fromEntries(
    [...candidatos]
      .filter(([, values]) => values.size === 1)
      .map(([name, values]) => [name, [...values][0]]),
  )
}

export function compararCrlv(veiculo, dados) {
  return ['placa', 'renavam', 'chassi'].map((name) => {
    const cadastro = identificador(veiculo?.[name])
    const documento = identificador(dados?.[name])
    return {
      name,
      cadastro: veiculo?.[name] || '',
      documento: dados?.[name] || '',
      status: !cadastro
        ? 'nao_cadastrado'
        : !documento
          ? 'nao_informado'
          : cadastro === documento
            ? 'confere'
            : 'divergente',
    }
  })
}

function documentoProprietarioValido(value) {
  const digits = String(value).replace(/\D/g, '')
  if (!/^(?:\d{11}|\d{14})$/.test(digits) || /^(\d)\1+$/.test(digits)) return false
  const cpf = digits.length === 11
  const calcular = (base) => {
    const soma = [...base].reduce(
      (total, digit, i) =>
        total + Number(digit) * (cpf ? base.length + 1 - i : ((base.length - 1 - i) % 8) + 2),
      0,
    )
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  const base = digits.slice(0, -2)
  const primeiro = calcular(base)
  return digits.endsWith(`${primeiro}${calcular(base + primeiro)}`)
}

// These are consistency checks, not evidence of authenticity or a government lookup.
export function conferirDadosCrlv(dados) {
  const renavam = String(dados.renavam || '').replace(/\D/g, '')
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const resto =
    [...renavam.slice(0, 10)].reduce((soma, digit, i) => soma + Number(digit) * pesos[i], 0) % 11
  const verificador = resto < 2 ? 0 : 11 - resto
  const checks = [
    {
      campo: 'placa',
      label: 'Placa',
      confere: /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(identificador(dados.placa)),
      ok: 'Formato válido',
      erro: 'Confira a placa na foto',
    },
    {
      campo: 'renavam',
      label: 'RENAVAM',
      confere:
        /^\d{11}$/.test(renavam) &&
        !/^(\d)\1+$/.test(renavam) &&
        Number(renavam.at(-1)) === verificador,
      ok: 'Dígito verificador confere',
      erro: 'Confira os números na foto',
    },
    {
      campo: 'chassi',
      label: 'Chassi',
      confere: /^[A-HJ-NPR-Z0-9]{17}$/.test(identificador(dados.chassi)),
      ok: 'Formato válido',
      erro: 'Confira os 17 caracteres na foto',
    },
  ]
  if (dados.cpf_cnpj_proprietario)
    checks.push({
      campo: 'cpf_cnpj_proprietario',
      label: 'CPF/CNPJ do proprietário',
      confere: documentoProprietarioValido(dados.cpf_cnpj_proprietario),
      ok: 'Dígitos verificadores conferem',
      erro: 'Confira os números na foto',
    })
  if (dados.ano_fabricacao && dados.ano_modelo)
    checks.push({
      campo: 'ano_modelo',
      label: 'Anos do veículo',
      confere: Number(dados.ano_modelo) >= Number(dados.ano_fabricacao),
      ok: 'Modelo e fabricação coerentes',
      erro: 'Ano do modelo anterior à fabricação; confira o documento',
    })
  return checks.map(({ ok, erro, ...check }) => ({ ...check, mensagem: check.confere ? ok : erro }))
}
