import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extrairCamposCnh, regioesCnh } from '../src/utils/cnh.js'
import { combinarLeiturasCnh, extrairCnhImagens } from '../src/utils/extrairCnhImagens.js'

const item = (text, x, y, height = 10) => ({ text, x, y, height, width: text.length * 5 })

test('reúne frente e verso e deriva EAR das observações do verso', () => {
  assert.deepEqual(
    combinarLeiturasCnh([
      { nome: 'MARIA DE SOUZA', numero_registro: '00123456789' },
      { numero_registro: '00123456789', observacao: 'EAR', cnh_expiracao: '2030-01-15' },
    ]),
    {
      dados: {
        nome: 'MARIA DE SOUZA',
        numero_registro: '00123456789',
        observacao: 'EAR',
        cnh_expiracao: '2030-01-15',
        ear: true,
      },
      conflitos: [],
    },
  )
})

test('não escolhe silenciosamente registro, data ou EAR divergentes entre fotos', () => {
  const resultado = combinarLeiturasCnh([
    { numero_registro: '00123456789', cnh_expiracao: '2030-01-15', ear: false },
    { numero_registro: '00987654321', cnh_expiracao: '2031-01-15', observacao: 'EAR' },
  ])
  assert.deepEqual(resultado.dados, { observacao: 'EAR' })
  assert.deepEqual(resultado.conflitos, ['numero_registro', 'cnh_expiracao', 'ear'])
})

test('reutiliza as fotos em cache sem OCR e conserva os conflitos entre variantes e lados', async () => {
  const frente = { name: 'frente.png' }
  const verso = { name: 'verso.png' }
  const leiturasFrente = Object.freeze([
    Object.freeze({
      nome: 'MARIA DE SOUZA',
      numero_registro: '00123456789',
      cnh_expiracao: '2030-01-15',
      ear: false,
    }),
    Object.freeze({
      nome: 'MARIA DE SOUZA',
      numero_registro: '00987654321',
      cnh_expiracao: '2031-01-15',
      observacao: 'EAR',
    }),
  ])
  const leiturasVerso = Object.freeze([
    Object.freeze({ numero_registro: '00123456789', cpf: '01149897295', ear: true }),
  ])
  const cache = new WeakMap([
    [frente, leiturasFrente],
    [verso, leiturasVerso],
  ])
  const esperado = {
    dados: { nome: 'MARIA DE SOUZA', observacao: 'EAR', cpf: '01149897295' },
    conflitos: ['numero_registro', 'cnh_expiracao', 'ear'],
    temTexto: false,
    usouOcr: true,
  }
  // Node has no document or browser workers: cached files must bypass their initialization.
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    assert.deepEqual(
      await extrairCnhImagens([frente, verso], new AbortController().signal, undefined, { cache }),
      esperado,
    )
  }
  assert.equal(cache.get(frente), leiturasFrente)
  assert.equal(cache.get(verso), leiturasVerso)
})

test('respeita o cancelamento mesmo quando ambas as fotos já estão no cache', async () => {
  const frente = { name: 'frente.png' }
  const verso = { name: 'verso.png' }
  const leiturasFrente = [{ nome: 'MARIA DE SOUZA' }]
  const leiturasVerso = [{ observacao: 'EAR' }]
  const cache = new WeakMap([
    [frente, leiturasFrente],
    [verso, leiturasVerso],
  ])
  const controller = new AbortController()
  const motivo = new Error('Leitura cancelada')
  controller.abort(motivo)
  await assert.rejects(
    extrairCnhImagens([frente, verso], controller.signal, undefined, { cache }),
    (erro) => erro === motivo,
  )
  assert.equal(cache.get(frente), leiturasFrente)
  assert.equal(cache.get(verso), leiturasVerso)
})

test('CNH com rótulos e valores em várias colunas mantém cada data no campo correto', () => {
  const page = [
    item('NOME', 10, 10),
    item('MARIA DE SOUZA', 10, 24),
    item('CPF', 10, 50),
    item('DATA NASCIMENTO', 210, 50),
    item('011.498.972-95', 10, 64),
    item('20/05/1990', 210, 64),
    item('Nº REGISTRO', 10, 90),
    item('00123456789', 10, 104),
    item('CAT. HAB.', 10, 130),
    item('1ª HABILITAÇÃO', 210, 130),
    item('AB', 10, 144),
    item('10/06/2008', 210, 144),
    item('DATA EMISSÃO', 10, 170),
    item('VALIDADE', 210, 170),
    item('15/01/2025', 10, 184),
    item('15/01/2030', 210, 184),
    item('OBSERVAÇÕES', 10, 210),
    item('EAR', 10, 224),
  ]
  assert.deepEqual(extrairCamposCnh([page]), {
    nome: 'MARIA DE SOUZA',
    cpf: '01149897295',
    data_nascimento: '1990-05-20',
    numero_registro: '00123456789',
    cnh_categoria: 'AB',
    primeira_habilitacao: '2008-06-10',
    data_emissao: '2025-01-15',
    cnh_expiracao: '2030-01-15',
    observacao: 'EAR',
    ear: true,
  })
})

test('CNH com rótulos numerados e local de nascimento ao lado da data', () => {
  const page = [
    item('2 e 1 NOME E SOBRENOME', 10, 10),
    item('JOÃO SILVA', 10, 24),
    item('3 DATA, LOCAL E UF DE NASCIMENTO', 10, 50),
    item('06/08/1999 PORTO VELHO/RO', 10, 64),
    item('4a DATA EMISSÃO', 10, 90),
    item('4b VALIDADE', 210, 90),
    item('01/02/2024', 10, 104),
    item('01/02/2034', 210, 104),
    item('4d CPF', 10, 130),
    item('5 Nº REGISTRO', 210, 130),
    item('52998224725', 10, 144),
    item('00012345678', 210, 144),
    item('9 CAT. HAB.', 10, 170),
    item('A', 10, 184),
  ]
  assert.deepEqual(extrairCamposCnh([page]), {
    nome: 'JOÃO SILVA',
    data_nascimento: '1999-08-06',
    data_emissao: '2024-02-01',
    cnh_expiracao: '2034-02-01',
    cpf: '52998224725',
    numero_registro: '00012345678',
    cnh_categoria: 'A',
  })
})

test('rótulos e valores na mesma linha preservam acentos e zeros à esquerda', () => {
  const page = [
    item('Nome completo: José de Araújo', 10, 10),
    item('CPF: 011.498.972-95', 10, 30),
    item('Número de registro: 00123456789', 10, 50),
    item('Primeira habilitação: 10.06.2008', 10, 70),
    item('EAR: Não', 10, 90),
  ]
  assert.deepEqual(extrairCamposCnh([page]), {
    nome: 'José de Araújo',
    cpf: '01149897295',
    numero_registro: '00123456789',
    primeira_habilitacao: '2008-06-10',
    ear: false,
  })
})

test('não adivinha o campo de números ou datas sem rótulos', () => {
  assert.deepEqual(
    extrairCamposCnh([
      [item('01149897295', 10, 10), item('00012345678', 10, 30), item('20/05/1990', 10, 50)],
    ]),
    {},
  )
})

test('não lê outro campo quando o valor está ausente', () => {
  assert.deepEqual(
    extrairCamposCnh([
      [
        item('Nome', 10, 10),
        item('FILIAÇÃO', 10, 24),
        item('JOÃO SILVA', 10, 38),
        item('CPF', 10, 60),
        item('DATA NASCIMENTO', 10, 74),
        item('20/05/1990', 10, 88),
      ],
    ]),
    { data_nascimento: '1990-05-20' },
  )
})

test('ignora datas inexistentes e CPF incompleto', () => {
  assert.deepEqual(
    extrairCamposCnh([[item('DATA EMISSÃO: 30/02/2026', 10, 10), item('CPF: 12345', 10, 30)]]),
    {},
  )
})

test('aceita dia bissexto válido', () => {
  assert.deepEqual(extrairCamposCnh([[item('DATA EMISSÃO: 29/02/2024', 10, 10)]]), {
    data_emissao: '2024-02-29',
  })
})

test('ignora valores conflitantes entre páginas e aceita valores repetidos', () => {
  const pages = [
    [item('CPF: 01149897295', 10, 10), item('VALIDADE: 01/02/2030', 10, 30)],
    [item('CPF: 01149897295', 10, 10), item('VALIDADE: 01/02/2035', 10, 30)],
  ]
  assert.deepEqual(extrairCamposCnh(pages), { cpf: '01149897295' })
})

test('ausência de EAR não é interpretada como não', () => {
  assert.deepEqual(extrairCamposCnh([[item('OBSERVAÇÕES: A', 10, 10)]]), { observacao: 'A' })
  assert.deepEqual(extrairCamposCnh([[item('OBSERVAÇÕES: EAR', 10, 10)]]), {
    observacao: 'EAR',
    ear: true,
  })
})

test('observações preservam várias linhas e param antes do próximo campo', () => {
  assert.deepEqual(
    extrairCamposCnh([
      [
        item('12 OBSERVAÇÕES', 10, 10),
        item('EAR', 10, 24),
        item('A, B', 10, 38),
        item('LOCAL', 10, 60),
        item('PORTO VELHO', 10, 74),
      ],
    ]),
    { observacao: 'EAR\nA, B', ear: true },
  )
})

test('observações vazias não capturam assinatura ou local', () => {
  assert.deepEqual(
    extrairCamposCnh([
      [item('OBSERVAÇÃO', 10, 10), item('ASSINATURA', 10, 24), item('MARIA', 10, 38)],
    ]),
    {},
  )
})

test('EAR conflitante nas observações exige conferência manual', () => {
  assert.deepEqual(
    extrairCamposCnh([[item('EAR: Não', 10, 10), item('OBSERVAÇÕES: EAR', 10, 30)]]),
    { observacao: 'EAR' },
  )
})

test('documento sem texto mantém o preenchimento manual disponível', () => {
  assert.deepEqual(extrairCamposCnh([[]]), {})
})

test('rótulo Número da CNH preenche somente o número de registro', () => {
  assert.deepEqual(extrairCamposCnh([[item('Nº CNH: 00123456789', 10, 10)]]), {
    numero_registro: '00123456789',
  })
})

const ocrWord = (text, x, y, width, height = 21, confidence = 95) => ({
  text,
  x,
  y,
  width,
  height,
  confidence,
})

test('recorte de nascimento inclui a data sem tratar LOCAL no próprio rótulo como outro campo', () => {
  const words = [
    ocrWord('3', 100, 50, 12),
    ocrWord('DATA,', 120, 50, 60),
    ocrWord('LOCAL', 185, 50, 70),
    ocrWord('E', 260, 50, 12),
    ocrWord('UF', 280, 50, 26),
    ocrWord('DE', 310, 50, 28),
    ocrWord('NASCIMENTO', 345, 50, 145),
  ]
  const [region] = regioesCnh(words, 1000, 1000)
  assert.equal(region.name, 'data_nascimento')
  assert.ok(region.width > 300)
  assert.equal(region.parse('20/05/1990, CIDADE, RO'), '1990-05-20')
})

test('fim do rótulo fica no próprio campo mesmo com grande espaço até o próximo', () => {
  const words = [
    ocrWord('NOME', 100, 50, 60),
    ocrWord('1ª', 800, 50, 20),
    ocrWord('HABILITAÇÃO', 830, 50, 140),
  ]
  const [region] = regioesCnh(words, 1200, 1000)
  assert.equal(region.name, 'nome')
  assert.equal(region.labelRight, 160)
  assert.ok(region.left + region.width < 800)
})

test('ruído alto da fotografia não separa DATA de EMISSÃO e legenda traduzida não cria um nome', () => {
  const words = [
    ocrWord('ruído', 10, 32, 50, 57),
    ocrWord('DATA', 100, 54, 60),
    ocrWord('EMISSÃO', 170, 50, 100),
    ocrWord('Nome', 100, 200, 60),
    ocrWord('/ Surname', 170, 200, 140),
  ]
  const regions = regioesCnh(words, 1000, 1000)
  assert.deepEqual(
    regions.map((region) => region.name),
    ['data_emissao'],
  )
  assert.equal(regions[0].labelLeft, 100)
})

test('foto reconhece ordinal lido como 13 e rótulo abreviado CAT sem alterar o PDF', () => {
  const words = [
    ocrWord('13', 100, 50, 20, 18),
    ocrWord('HABILITAÇÃO', 125, 50, 140, 18),
    ocrWord('CAT.', 400, 50, 45, 18),
  ]
  assert.deepEqual(
    regioesCnh(words, 1000, 1200, { foto: true }).map((region) => region.name),
    ['cnh_categoria', 'primeira_habilitacao'],
  )
  assert.deepEqual(regioesCnh(words, 1000, 1200), [])
})

test('legenda do verso em várias linhas não preenche campos da fotografia', () => {
  const words = [
    ocrWord('NOME', 100, 400, 60),
    ocrWord('Surname', 170, 425, 90),
    ocrWord('First', 100, 450, 60),
    ocrWord('CATEGORIA', 100, 480, 120),
    ocrWord('B', 100, 510, 15),
    ocrWord('OBSERVAÇÕES', 100, 550, 140),
    ocrWord('EAR', 100, 580, 45),
  ]
  assert.deepEqual(regioesCnh(words, 1000, 1200, { foto: true }), [])
  assert.deepEqual(extrairCamposCnh([words], { foto: true }), {})
})
