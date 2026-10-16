const campo = (chave, label, tipo = 'texto') => ({ chave, label, tipo })
const pessoais = (prefixo = '') => [
  campo(`${prefixo}name`, 'Nome completo'),
  campo(`${prefixo}cpf`, 'CPF', 'cpf'),
  campo(`${prefixo}data_nascimento`, 'Data de nascimento', 'data'),
]
const contatos = [campo('email', 'E-mail'), campo('telefone', 'Telefone', 'telefone')]
export const configuracoesDetalhes = {
  usuario: { titulo: 'Dados do usuário', endpoint: 'users', campos: pessoais() },
  motorista: {
    titulo: 'Dados do motorista',
    endpoint: 'motoristas',
    imagem: 'foto',
    campos: [
      ...pessoais('user.'),
      ...contatos,
      campo('status', 'Status', 'status'),
      campo('numero_registro', 'Número de registro da CNH'),
      campo('cnh_categoria', 'Categoria da CNH'),
      campo('primeira_habilitacao', 'Primeira habilitação', 'data'),
      campo('data_emissao', 'Emissão da CNH', 'data'),
      campo('cnh_expiracao', 'Validade da CNH', 'data'),
      campo('ear', 'Exerce atividade remunerada', 'booleano'),
      campo('observacao', 'Observações da CNH'),
    ],
  },
  passageiro: {
    titulo: 'Dados do passageiro',
    endpoint: 'passageiros',
    imagem: 'foto',
    campos: [
      ...pessoais('user.'),
      ...contatos,
      campo('status', 'Status', 'status'),
      campo('media_avaliacao', 'Média de avaliação'),
    ],
  },
  gestor: {
    titulo: 'Dados do gestor',
    endpoint: 'gestores',
    imagem: 'foto',
    campos: [...pessoais(), ...contatos],
  },
  corrida: {
    titulo: 'Dados da corrida',
    campos: [
      campo('codigo_corrida', 'Código da corrida'),
      campo('motorista.user.name', 'Motorista'),
      campo('passageiro.user.name', 'Passageiro'),
      campo('convidado_nome', 'Nome do convidado'),
      campo('convidado_telefone', 'Telefone do convidado', 'telefone'),
      campo('veiculo.placa', 'Placa do veículo'),
      campo('produto.nome', 'Produto'),
      campo('status_corrida', 'Status da corrida', 'status'),
      campo('status_negociacao', 'Status da negociação', 'status'),
      campo('status_pagamento', 'Status do pagamento', 'status'),
      campo('metodo_pagamento', 'Forma de pagamento'),
      campo('corrida_destinos', 'Trajeto', 'destinos'),
      campo('tempo_solicitacao', 'Solicitação', 'horario'),
      campo('tempo_aceite', 'Aceite', 'horario'),
      campo('tempo_inicio', 'Início', 'horario'),
      campo('tempo_final', 'Finalização', 'horario'),
      campo('distancia_total', 'Distância total'),
      campo('valor_estimado_inicial', 'Valor estimado', 'moeda'),
      campo('valor_negociado_final', 'Valor negociado', 'moeda'),
      campo('motivo_cancelamento', 'Motivo do cancelamento'),
      ...[
        ['valor_bruto', 'Valor bruto'],
        ['tarifa_base', 'Tarifa base'],
        ['taxa_espera', 'Taxa de espera'],
        ['valor_pago_passageiro', 'Valor pago pelo passageiro'],
        ['valor_descontos', 'Descontos'],
        ['taxa_plataforma_valor', 'Valor da plataforma'],
        ['valor_motorista', 'Valor do motorista'],
      ].map(([chave, label]) => campo(`corrida_financeiro.${chave}`, label, 'moeda')),
    ],
  },
  tarifa: {
    titulo: 'Dados da tarifa',
    campos: [
      campo('produto.nome', 'Produto'),
      campo('cidade_id', 'ID da cidade'),
      campo('horario_inicio', 'Horário inicial'),
      campo('horario_fim', 'Horário final'),
      campo('dias_semana', 'Dias da semana', 'lista'),
      campo('vira_dia', 'Termina no dia seguinte', 'booleano'),
      ...[
        ['valor_minimo_corrida', 'Valor mínimo da corrida'],
        ['tarifa_base', 'Tarifa base'],
        ['valor_por_km', 'Valor por km'],
        ['valor_por_minuto', 'Valor por minuto'],
        ['valor_por_minuto_espera', 'Valor por minuto de espera'],
      ].map(([chave, label]) => campo(chave, label, 'moeda')),
      campo('taxa_plataforma_percentual', 'Taxa da plataforma (%)'),
      campo('raio_busca_motorista_km', 'Raio de busca (km)'),
      campo('ativo', 'Ativa', 'booleano'),
    ],
  },
  produto: {
    titulo: 'Dados do produto',
    campos: [
      campo('nome', 'Nome'),
      campo('codigo', 'Código'),
      campo('estrategia_precificacao', 'Estratégia de precificação'),
      campo('grupo', 'Grupo'),
      campo('tipo_veiculo', 'Tipo de veículo'),
      campo('requisito_veiculo', 'Requisito do veículo'),
      campo('prioritario', 'Prioritário', 'booleano'),
      campo('ordem', 'Ordem'),
    ],
  },
  categoria_produto: {
    titulo: 'Dados da categoria de produto',
    campos: [
      campo('categoria', 'Categoria'),
      campo('produto.nome', 'Produto'),
      campo('prioridade', 'Prioridade'),
    ],
  },
  midia: {
    titulo: 'Dados da mídia',
    imagem: 'url',
    campos: [
      campo('titulo', 'Título'),
      campo('cidade.nome', 'Cidade'),
      campo('cidade_id', 'ID da cidade'),
      campo('name', 'Nome do arquivo'),
      campo('mime_type', 'Tipo do arquivo'),
      campo('size', 'Tamanho (bytes)'),
    ],
  },
}

export function valorPreenchido(valor) {
  return (
    valor !== null &&
    valor !== undefined &&
    (typeof valor !== 'string' || valor.trim() !== '') &&
    (!Array.isArray(valor) || valor.length > 0)
  )
}

export function lerCampo(registro, caminho) {
  return caminho.split('.').reduce((valor, chave) => valor?.[chave], registro)
}

function formatarValor(valor, tipo) {
  const texto = String(valor)
  if (tipo === 'data') {
    const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/)
    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : texto
  }
  if (tipo === 'horario') {
    const data = new Date(valor)
    return Number.isNaN(data.getTime()) ? texto : data.toLocaleString('pt-BR')
  }
  if (tipo === 'cpf') return texto.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (tipo === 'telefone') return texto.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')
  if (tipo === 'booleano') return [true, 1, '1'].includes(valor) ? 'Sim' : 'Não'
  if (tipo === 'moeda') {
    const numero = Number(valor)
    return Number.isFinite(numero)
      ? numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : texto
  }
  if (tipo === 'destinos')
    return Array.isArray(valor)
      ? valor
          .map((item) => item.endereco)
          .filter(valorPreenchido)
          .join('\n')
      : ''
  if (tipo === 'lista') {
    if (Array.isArray(valor)) return valor.join(', ')
    try {
      const lista = JSON.parse(texto)
      if (Array.isArray(lista)) return lista.join(', ')
    } catch {
      // Valores de texto continuam sendo exibidos como foram cadastrados.
    }
    return texto
  }
  if (tipo === 'status') {
    const nomes = {
      ativo: 'Ativo',
      pendente: 'Pendente',
      aprovado: 'Aprovado',
      reprovado: 'Reprovado',
      em_analise: 'Em análise',
      nao_enviado: 'Não enviado',
      finalizada: 'Finalizada',
      em_andamento: 'Em andamento',
      solicitada: 'Solicitada',
      cancelada: 'Cancelada',
      aceita: 'Aceita',
      aguardando_pagamento: 'Aguardando pagamento',
      em_negociacao: 'Em negociação',
    }
    return nomes[texto] || texto.replaceAll('_', ' ')
  }
  return texto
}

export function camposDetalhes(tipo, registro) {
  return (configuracoesDetalhes[tipo]?.campos || [])
    .map((campo) => ({ ...campo, valor: lerCampo(registro, campo.chave) }))
    .filter((campo) => valorPreenchido(campo.valor))
    .map((campo) => ({ ...campo, valor: formatarValor(campo.valor, campo.tipo) }))
    .filter((campo) => valorPreenchido(campo.valor))
}
