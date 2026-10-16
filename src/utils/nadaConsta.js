export const URL_VALIDACAO_PF = 'https://servicos.pf.gov.br/epol-sinic-publico/validar-cac/'

const normalizar = (texto) => texto.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()

function dataIso(value) {
  const match = value?.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/)
  if (!match) return
  const iso = `${match[3]}-${match[2]}-${match[1]}`
  const date = new Date(`${iso}T00:00:00Z`)
  if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso) return iso
}

export function calcularValidadeCertidao(emissao, dias = 90) {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(emissao || '')) return ''
  const date = new Date(`${emissao.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== emissao.slice(0, 10))
    return ''
  date.setUTCDate(date.getUTCDate() + dias)
  return date.toISOString().slice(0, 10)
}

function linhasDaPagina(items) {
  const linhas = []
  for (const item of [...items]
    .filter((i) => i.text?.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x)) {
    const tolerancia = Math.max(2, Math.min(item.height || 10, 20) * 0.4)
    let linha = linhas.find((l) => Math.abs(l.y - item.y) <= tolerancia)
    if (!linha) {
      linha = { y: item.y, items: [] }
      linhas.push(linha)
    }
    linha.items.push(item)
  }
  return linhas
    .map((l) =>
      l.items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.text.trim())
        .join(' '),
    )
    .join('\n')
}

function extrairPagina(items) {
  const linhas = typeof items === 'string' ? items : linhasDaPagina(items)
  const texto = linhas.replace(/\s+/g, ' ').trim()
  const normalizado = normalizar(texto)
  const normalizadoLinhas = normalizar(linhas)
  // Não aproveitar CPF/nascimento de um arquivo que não seja uma certidão criminal.
  if (!/CERTIDAO[^\n]{0,120}(?:ANTECEDENTES|CRIMIN|NEGATIVA)/.test(normalizadoLinhas)) return {}
  const dados = {}
  const numero =
    normalizadoLinhas.match(
      /(?:^|\n)\s*(?:N(?:[°º.]|O\b|(?=\s*[:.-]?\s*\d))\s*|NUMERO(?: DA CERTIDAO)?\s*)[:.-]?\s*([A-Z0-9][A-Z0-9./-]{5,99})(?=\s|$)/,
    )?.[1] ||
    normalizado.match(/NUMERO DA CERTIDAO\s*[:.-]?\s*([A-Z0-9][A-Z0-9./-]{5,99})(?=\s|$)/)?.[1]
  if (numero) dados.numero_certidao = numero
  if (/POLICIA FEDERAL/.test(normalizado.slice(0, 1000))) dados.orgao_emissor = 'Polícia Federal'
  else {
    const orgao = linhas.match(/(?:ÓRGÃO|ORGAO) EMISSOR\s*:\s*([^\n]+)/i)?.[1]?.trim()
    if (orgao) dados.orgao_emissor = orgao
  }
  const nome =
    normalizado
      .match(/EM NOME DE\s+([A-Z '\u2019-]+?)(?=\s*,|\s+PAIS\b|\s+FILH[OA]\b)/)?.[1]
      ?.trim() ||
    normalizadoLinhas.match(/(?:^|\n)\s*NOME(?: COMPLETO)?\s*:\s*([^\n]+)/)?.[1]?.trim()
  if (nome && nome.length <= 255) dados.nome = nome
  const pai = linhas.match(/(?:^|\n)\s*(?:NOME\s+(?:DO\s+)?)?PAI\s*:\s*([^\n]+)/i)?.[1]?.trim()
  const mae = linhas.match(/(?:^|\n)\s*(?:NOME\s+(?:DA\s+)?)?M[ÃA]E\s*:\s*([^\n]+)/i)?.[1]?.trim()
  const filiacao = texto.match(
    /FILH[OA](?:\([AO]\))?\s+DE\s+(.+?)(?=,\s*NASCID[OA]|\s+NASCID[OA])/i,
  )?.[1]
  const pais = filiacao?.split(/\s+[eE]\s+/)
  // No modelo da PF, a filiação traz pai e mãe nesta ordem. Um único nome
  // sem rótulo não permite identificar qual dos dois foi informado.
  const nomes = {
    nome_pai:
      pai || (dados.orgao_emissor === 'Polícia Federal' && pais?.length === 2 ? pais[0] : ''),
    nome_mae:
      mae || (dados.orgao_emissor === 'Polícia Federal' && pais?.length === 2 ? pais[1] : ''),
  }
  for (const [campo, valor] of Object.entries(nomes)) {
    const nome = valor.trim()
    if (
      nome &&
      nome.length <= 255 &&
      !/^(?:NAO INFORMAD[OA]|DESCONHECID[OA]|IGNORAD[OA])$/.test(normalizar(nome))
    )
      dados[campo] = nome.toUpperCase()
  }
  const cpf = normalizado
    .match(/\bCPF\s*[:.-]?\s*(\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2})\b/)?.[1]
    ?.replace(/\D/g, '')
  if (cpf) dados.cpf = cpf
  const nascimento = normalizado.match(
    /(?:NASCID[OA](?:\([AO]\))?\s+(?:AOS\s+|EM\s+)?|DATA (?:DE )?NASCIMENTO\s*:?\s*)(\d{2}[./-]\d{2}[./-]\d{4})/,
  )?.[1]
  if (dataIso(nascimento)) dados.data_nascimento = dataIso(nascimento)
  const emissao = normalizado.match(
    /(?:EXPEDIDA EM|EMITIDA EM|DATA (?:DE )?EMISSAO|EMISSAO)\s*:?\s*(\d{2}[./-]\d{2}[./-]\d{4})(?:\s*(?:AS|A[SÀ]|[-,])?\s*(\d{2}:\d{2}))?/,
  )
  if (dataIso(emissao?.[1])) {
    const hora = emissao?.[2]
    dados.data_emissao = dataIso(emissao[1])
    if (hora && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) dados.hora_emissao = hora
  }
  const validade = normalizado.match(
    /(?:VALIDADE|VALID[AO] ATE|DATA (?:DE )?VALIDADE)\s*:?\s*(\d{2}[./-]\d{2}[./-]\d{4})/,
  )?.[1]
  const dias = normalizado.match(/VALID[AO]\s+POR\s+(\d{1,3})\s+DIAS/)?.[1]
  if (dataIso(validade)) dados.data_validade = dataIso(validade)
  else if (dados.data_emissao && (dias || dados.orgao_emissor === 'Polícia Federal')) {
    dados.data_validade = calcularValidadeCertidao(dados.data_emissao, dias ? Number(dias) : 90)
  }
  // Preserva o teor impresso, sem transformar a extração em validação de autenticidade.
  const resultado =
    texto.match(/\b((?:(?:NÃO|NAO|NADA)\s+)?CONSTA(?:M)?\s+.+?)(?=\s+em nome de\b)/i)?.[1] ||
    linhas.match(/RESULTADO\s*:\s*([^\n]+)/i)?.[1]
  if (resultado) dados.resultado = resultado.trim()
  return dados
}

export function extrairCamposNadaConsta(pages, conflitos = new Set()) {
  const dados = {}
  for (const pagina of pages) {
    for (const [campo, valor] of Object.entries(extrairPagina(pagina))) {
      if (dados[campo] && dados[campo] !== valor) conflitos.add(campo)
      else dados[campo] = valor
    }
  }
  conflitos.forEach((campo) => delete dados[campo])
  return dados
}
