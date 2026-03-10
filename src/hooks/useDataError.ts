import { useState } from "react"

type Camada = 'profile' | 'appointments' | 'loyalty' | 'shop'

interface DataError {
  camada: Camada
  mensagem: string
  timestamp: number
}

export function useDataError() {
  const [errors, setErrors] = useState<DataError[]>([])

  function reportError(camada: Camada, erro: unknown) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido'
    setErrors(prev => [...prev, { camada, mensagem, timestamp: Date.now() }])
  }

  function clearErrors() {
    setErrors([])
  }

  return {
    hasError: errors.length > 0,
    errors,
    reportError,
    clearErrors
  }
}
