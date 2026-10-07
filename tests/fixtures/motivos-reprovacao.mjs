// Contrato do catálogo retornado pelo enum do backend.
export const motivosReprovacao = [
  { value: 'ilegivel', label: 'Documento ilegível', exige_descricao: false },
  { value: 'incompleto', label: 'Documento incompleto', exige_descricao: false },
  { value: 'vencido', label: 'Documento vencido', exige_descricao: false },
  { value: 'dados_divergentes', label: 'Dados divergentes', exige_descricao: false },
  { value: 'tipo_incorreto', label: 'Tipo de documento incorreto', exige_descricao: false },
  { value: 'frente_verso_ausente', label: 'Frente ou verso ausente', exige_descricao: false },
  { value: 'outro', label: 'Outro', exige_descricao: true },
]
