// Contrato do catálogo retornado pelo enum do backend.
export const tiposDocumento = [
  {
    tipo_documento: 'cnh',
    titulo: 'CNH',
    descricao: 'CARTEIRA NACIONAL DE HABILITAÇÃO',
    possui_dados_cnh: true,
  },
  {
    tipo_documento: 'crlv',
    titulo: 'VEÍCULO - CRLV',
    descricao: 'CERTIFICADO DE REGISTRO E LICENCIAMENTO DO VEÍCULO',
    possui_dados_cnh: false,
  },
  {
    tipo_documento: 'nada_consta',
    titulo: 'NADA CONSTA',
    descricao: 'CERTIDÃO NEGATIVA DE ANTECEDENTES CRIMINAIS',
    possui_dados_cnh: false,
  },
  {
    tipo_documento: 'seguro_obrigatorio',
    titulo: 'SEGURO',
    descricao: 'SEGURO OBRIGATÓRIO',
    possui_dados_cnh: false,
  },
]
