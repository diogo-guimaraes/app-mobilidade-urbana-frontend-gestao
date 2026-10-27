export const resultadosPlataforma = [
  { value: 'todos', label: 'Todos (ganhos e saídas)' },
  { value: 'positivo', label: 'Ganhos (positivos)' },
  { value: 'negativo', label: 'Saídas (negativos)' },
]
export const tituloResultadoPlataforma = (resultado) =>
  ({
    positivo: 'Ganhos realizados · consolidados',
    negativo: 'Saídas realizadas · consolidadas',
  })[resultado] || 'Lucro líquido realizado · consolidado'

export const custosPlataforma = [
  { campo: 'custo_gateway', label: 'Taxa do gateway' },
  { campo: 'subsidio_aplicado', label: 'Subsídio / desconto do app' },
  { campo: 'bonus_alocado', label: 'Bônus / recompensa alocada' },
  { campo: 'compensacao_paga', label: 'Compensações / reembolsos' },
]
export const origemPlataforma = (valor) =>
  ({
    online_cartao: 'Cartão no app',
    online_pix: 'PIX no app',
    dinheiro_motorista: 'Dinheiro com o motorista',
    nao_identificada: 'Origem não identificada',
  })[valor] || 'Origem não identificada'
export const caixaPlataforma = (valor, tipo = 'comissao_corrida') =>
  valor === 'realizado_em_conta' && tipo !== 'comissao_corrida'
    ? 'Pagamento do custo conferido'
    : {
        realizado_em_conta: 'Recebimento comprovado',
        a_receber_motorista: 'Comissão a receber do motorista',
        aguardando_liquidacao: 'Aguardando comprovação do recebimento',
        estornado: 'Estornado / origem invalidada',
      }[valor] || 'Situação não identificada'
export const naturezaPlataforma = (valor) =>
  ({
    comissao_corrida: 'Comissão da corrida',
    subsidio_tarifa: 'Subsídio',
    recompensa_bonus: 'Bônus / recompensa',
    compensacao_reembolso: 'Compensação / reembolso',
    ajuste_manual: 'Ajuste',
  })[valor] || 'Operação'
export const iconePlataforma = (valor) =>
  ({
    comissao_corrida: 'paid',
    subsidio_tarifa: 'local_offer',
    recompensa_bonus: 'redeem',
    compensacao_reembolso: 'currency_exchange',
    ajuste_manual: 'tune',
  })[valor] || 'receipt_long'
