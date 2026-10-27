export const tiposMovimentacao = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
]
export const categoriasMovimentacao = [
  { value: null, label: 'Todos' },
  { value: 'valor_corrida', label: 'Valor da corrida' },
  { value: 'recompensa', label: 'Recompensa' },
  { value: 'gorjeta', label: 'Gorjeta' },
  { value: 'compensacao', label: 'Compensação' },
  { value: 'ganhos_integrais', label: '100% dos ganhos' },
  { value: 'transferencia', label: 'Transferência / Resgate' },
  { value: 'descontos_taxas', label: 'Descontos e taxas' },
  { value: 'ajustes_estornos', label: 'Ajustes e estornos' },
  { value: 'outro', label: 'Outro' },
]
export const statusMovimentacao = [
  { value: 'confirmado', label: 'Confirmada', color: 'positive' },
  { value: 'processando', label: 'Em processamento', color: 'orange-8' },
  { value: 'falhou', label: 'Falhou', color: 'negative' },
  { value: 'cancelado', label: 'Cancelada', color: 'grey-7' },
]
export const situacaoMovimentacao = (value) =>
  statusMovimentacao.find((item) => item.value === value) || {
    label: value || 'Não informado',
    color: 'grey-7',
  }
export const moedaSaldo = (value) =>
  value == null || value === '' || !Number.isFinite(Number(value))
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
export const valorMovimentacao = (item) =>
  (item.tipo === 'entrada' ? '+ ' : '- ') + moedaSaldo(item.valor)
export const tituloMovimentacao = (item) => item.titulo || item.descricao
export const pagamentoSaldo = (value) =>
  ({
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    cartao: 'Cartão online',
    cartao_online: 'Cartão online',
    carteira: 'Carteira',
    saldo_app: 'Carteira',
    saldo_carteira: 'Carteira',
  })[value] ||
  value ||
  'Não informado'
export const horarioSaldo = (value) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(
        new Date(value),
      )
    : 'Não informado'
