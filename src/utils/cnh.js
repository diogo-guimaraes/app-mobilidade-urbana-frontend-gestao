const normalize = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()

function dateValue(text) {
  const match = text.match(/(?<!\d)(\d{2})[./-](\d{2})[./-](\d{4})(?!\d)/)
  if (!match) return
  const [, day, month, year] = match
  const value = `${year}-${month}-${day}`
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value) return value
}

function numberValue(text) {
  const match = text.trim().match(/^(\d(?:[ .-]?\d){4,19})(?!\d)/)
  if (match) return match[1].replace(/\D/g, '')
}

function nameValue(text) {
  const value = text.trim().replace(/\s+/g, ' ')
  if (!/^[\p{L}][\p{L}\s.'’-]{2,254}$/u.test(value)) return
  if (
    /\b(?:FILIACAO|ASSINATURA|PERMISSAO|OBSERVACOES|NACIONALIDADE|DOCUMENTO|IDENTIDADE)\b/.test(
      normalize(value),
    )
  )
    return
  return value
}

function earValue(text) {
  const value = normalize(text.trim())
  if (/^(?:NAO|N)(?:\b|$)/.test(value) || /\bEAR\s*[:-]?\s*NAO\b/.test(value)) return false
  if (/^(?:SIM|S)(?:\b|$)/.test(value) || /\bEAR\b|\bEXERCE ATIVIDADE REMUNERADA\b/.test(value))
    return true
}

export function resolverCamposCnh(candidates) {
  for (const value of candidates.get('observacao') || []) {
    const observacao = normalize(value)
    const ear = /\bEAR\b|\bEXERCE ATIVIDADE REMUNERADA\b/.test(observacao)
      ? earValue(observacao)
      : undefined
    if (ear !== undefined) {
      if (!candidates.has('ear')) candidates.set('ear', new Set())
      candidates.get('ear').add(ear)
    }
  }
  // Conflicting values require manual entry, rather than choosing a random page.
  return Object.fromEntries(
    [...candidates]
      .filter(([, values]) => values.size === 1)
      .map(([name, values]) => [name, [...values][0]]),
  )
}

const fields = [
  {
    name: 'nome',
    label: /\bNOME(?:\s+COMPLETO|\s+E\s+SOBRENOME)?\b(?!\s+(?:DO|DA)\b)/g,
    parse: nameValue,
  },
  {
    name: 'cpf',
    label: /\bCPF\b/g,
    parse: (text) =>
      text.match(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/)?.[0].replace(/\D/g, ''),
  },
  {
    name: 'data_nascimento',
    label:
      /\bDATA(?:\s+DE)?\s+NASCIMENTO\b|\bDATA[.,\s]+(?:LOCAL(?:\s+E\s+UF)?|E\s+LOCAL(?:\s+E\s+UF)?)\s+DE\s+NASCIMENTO\b/g,
    parse: dateValue,
  },
  {
    name: 'numero_registro',
    label:
      /\b(?:N[º°O.]?|NUMERO)(?:\s+DA)?\s*CNH\b|(?:\bN[º°O.]?\s*|\bNUMERO(?:\s+DE)?\s+)?\bREGISTRO\b(?!\s+GERAL)/g,
    parse: numberValue,
  },
  {
    name: 'cnh_categoria',
    label: /\b(?:CAT\.?\s*HAB\b\.?|CATEGORIA(?:\s+DE\s+HABILITACAO)?\b)/g,
    parse: (text) => normalize(text.trim()).match(/^(?:A[B-E]?|[B-E])\b/)?.[0],
  },
  {
    name: 'primeira_habilitacao',
    label: /(?:\b1[ªAºO°]?\s*|\bPRIMEIRA\s+)HABILITACAO\b/g,
    parse: dateValue,
  },
  { name: 'data_emissao', label: /\b(?:DATA(?:\s+DE)?\s+)?EMISSAO\b/g, parse: dateValue },
  { name: 'cnh_expiracao', label: /\b(?:DATA(?:\s+DE)?\s+)?VALIDADE\b/g, parse: dateValue },
  { name: 'ear', label: /\bEAR\b(?=\s*[:-]?\s*(?:SIM|NAO)\b)/g, parse: earValue },
  {
    name: 'observacao',
    label: /\bOBSERVAC(?:OES|AO)\b/g,
    parse: (text) => text.trim().replace(/[ \t]+/g, ' ') || undefined,
  },
  { label: /\b(?:FILIACAO|DOC\.?\s*IDENTIDADE|ASSINATURA|NACIONALIDADE|PERMISSAO|ACC|LOCAL)\b/g },
]

function buildRows(items) {
  const rows = []
  for (const item of items
    .filter((item) => item.text.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = rows.at(-1)
    if (last && Math.abs(last.y - item.y) <= Math.max(last.height, item.height) * 0.4) {
      last.items.push(item)
    } else {
      rows.push({ y: item.y, height: item.height, items: [item] })
    }
  }
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x)
    row.text = ''
    row.spans = row.items.map((item) => {
      if (row.text) row.text += ' '
      const start = row.text.length
      row.text += item.text
      return { ...item, start, end: row.text.length }
    })
  }
  return rows
}

function position(row, index) {
  const span = row.spans.find((span) => index < span.end) || row.spans.at(-1)
  const offset = Math.max(0, index - span.start)
  // Numbered labels ("4d CPF", "5 Nº REGISTRO") share the value's left edge.
  if (/^[\d\s.e]+$/i.test(span.text.slice(0, offset))) return span.x
  return span.x + (span.width * offset) / span.text.length
}

function findLabels(rows, { foto = false } = {}) {
  return rows.flatMap((row, rowIndex) =>
    fields.flatMap((field) => {
      let text = normalize(row.text)
      if (foto) text = text.replace(/\b1[23](?=\s+HABILITACAO\b)/g, '1A')
      const pattern =
        foto && field.name === 'cnh_categoria'
          ? /\bCAT\.?(?:\s*HAB\.?)?\b|\bCATEGORIA\b/g
          : foto &&
              field.name === 'nome' &&
              rows.some(
                (other) =>
                  /\bSOBRENOME\b/.test(normalize(other.text)) &&
                  Math.abs(other.y - row.y) <= Math.max(other.height, row.height) * 2,
              )
            ? /\bN[O0][MNV][E3](?:\s+E\s+SOBRENOME)?\b/g
            : field.label
      return [...text.matchAll(pattern)].map((match) => {
        const prefix = text
          .slice(0, match.index)
          .match(/(?:^|(?<=\s))[1-9][A-E]?(?:\s+E\s+[1-9])?\s+$/)
        const start = prefix?.index ?? match.index
        const spans = row.spans.filter(
          (span) => span.end > start && span.start < match.index + match[0].length,
        )
        const heights = spans.map((span) => span.height).sort((a, b) => a - b)
        return {
          ...field,
          rowIndex,
          start,
          end: match.index + match[0].length,
          x: position(row, start),
          right: Math.max(...spans.map((span) => span.x + span.width)),
          y: Math.min(...spans.map((span) => span.y)),
          height:
            (heights[Math.floor((heights.length - 1) / 2)] +
              heights[Math.floor(heights.length / 2)]) /
            2,
        }
      })
    }),
  )
}

function semLegendasTraduzidas(items) {
  const marcadores = items.filter((item) =>
    /^(?:SURNAME|FIRST|BIRTH|FECHA|NATIONALITY|ISSUANCE|ISSUING|DDMMYYYY)$/.test(
      normalize(item.text).replace(/[^A-Z]/g, ''),
    ),
  )
  if (new Set(marcadores.map((item) => normalize(item.text))).size < 2) return items
  const inicio = Math.min(...marcadores.map((item) => item.y - item.height * 3))
  return items.filter((item) => item.y < inicio)
}

// Read the value area separately so the photograph and box borders cannot join the text.
export function regioesCnh(items, width, height, { foto = false } = {}) {
  if (foto) items = semLegendasTraduzidas(items)
  const rows = buildRows(
    items.filter(
      (item) =>
        item.height >= (foto ? 6 : 10) &&
        item.height <= (foto ? Math.max(40, Math.max(width, height) * 0.03) : 40) &&
        item.confidence >= 35,
    ),
  )
  const labels = findLabels(rows, { foto }).filter(
    (label) =>
      !/\b(?:SURNAME|FIRST|LICENSE|BIRTH|FECHA|DD\/MM|DDMMYYYY|IDENTITY|NATIONALITY|OBSERVATIONS|EXPIRATION|ISSUING)\b/i.test(
        rows[label.rowIndex].text,
      ),
  )
  return labels
    .filter((label) => label.parse)
    .map((label) => {
      const next = labels
        .filter((other) => other.rowIndex === label.rowIndex && other.start >= label.end)
        .sort((a, b) => a.x - b.x)[0]
      const left = Math.max(
        0,
        Math.floor(label.x - label.height * (foto && label.name === 'nome' ? 4.5 : 2.5)),
      )
      const top = Math.max(0, Math.ceil(label.y + label.height * 1.3))
      const right = Math.min(
        width,
        next
          ? next.x - label.height * 2
          : label.x + label.height * (label.name === 'nome' ? 70 : 25),
      )
      const below = labels
        .filter((other) => other.y > top && other.x >= label.x - label.height && other.x < right)
        .sort((a, b) => a.y - b.y)[0]
      const bottom = Math.min(
        height,
        Math.floor(
          label.y + label.height * (label.name === 'observacao' ? (foto ? 4.5 : 12) : 3.8),
        ),
        label.name === 'observacao' && below ? below.y - label.height * 0.5 : height,
      )
      return {
        name: label.name,
        parse: label.parse,
        labelLeft: label.x,
        labelRight: label.right,
        left,
        top,
        width: right - left,
        height: bottom - top,
      }
    })
    .filter((region) => region.width > 0 && region.height > 0)
}

/** Recognizes values near CNH labels; items use coordinates in the visible page. */
export function extrairCamposCnh(pages, { foto = false } = {}) {
  const candidates = new Map()
  for (const items of pages) {
    const rows = buildRows(foto ? semLegendasTraduzidas(items) : items)
    const labels = findLabels(rows, { foto }).filter(
      (label) =>
        !foto ||
        !/\b(?:SURNAME|FIRST|LICENSE|BIRTH|FECHA|DD\/MM|DDMMYYYY|IDENTITY|NATIONALITY|OBSERVATIONS|EXPIRATION|ISSUING)\b/i.test(
          rows[label.rowIndex].text,
        ),
    )
    for (const label of labels.filter((label) => label.parse)) {
      const row = rows[label.rowIndex]
      const next = labels
        .filter((other) => other.rowIndex === label.rowIndex && other.start >= label.end)
        .sort((a, b) => a.start - b.start)[0]
      const right = next?.x ?? Infinity
      const inline = row.text.slice(label.end, next?.start).replace(/^[\s:|-]+/, '')
      let value = label.parse(inline)
      if (label.name === 'observacao' || (value === undefined && !inline.trim())) {
        const lines = inline.trim() ? [inline.trim()] : []
        const tolerance = Math.max(row.height, 8) * 1.5
        for (let i = label.rowIndex + 1; i < rows.length; i++) {
          const below = rows[i]
          if (below.y - row.y > Math.max(row.height * (label.name === 'observacao' ? 12 : 4), 36))
            break
          const hasLabel = labels.some(
            (other) => other.rowIndex === i && other.x >= label.x - tolerance && other.x < right,
          )
          if (hasLabel) break
          const text = below.spans
            .filter((span) => span.x >= label.x - tolerance && span.x < right - 2)
            .map((span) => span.text)
            .join(' ')
          if (label.name === 'observacao') {
            if (text.trim()) lines.push(text.trim())
          } else {
            value = label.parse(text)
            if (value !== undefined) break
          }
        }
        if (label.name === 'observacao') value = label.parse(lines.join('\n'))
      }
      if (value !== undefined) {
        if (!candidates.has(label.name)) candidates.set(label.name, new Set())
        candidates.get(label.name).add(value)
      }
    }
  }
  return resolverCamposCnh(candidates)
}
