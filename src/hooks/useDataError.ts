import { useState, useRef } from "react"

type Camada = 'profile' | 'appointments' | 'loyalty' | 'shop'

interface DataError {
  camada: Camada
  mensagem: string
  timestamp: number
  tentativas: number
}

// False-positive error messages that should be silently ignored
const FALSE_POSITIVE_PATTERNS = [
  'no rows found',
  'json object requested, multiple (or no) rows returned',
  'undefined',
  'null',
  'aborterror',
  'the user aborted a request',
  'fetchevent',
  'failed to fetch',
  'load failed',
  'networkerror',
]

export function useDataError() {
  const [errors, setErrors] = useState<DataError[]>([])
  const mountedAt = useRef<number>(Date.now())

  function reportError(camada: Camada, erro: unknown) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)

    // Filter out false positives
    const lowerMsg = mensagem.toLowerCase()
    const isFalsePositive = FALSE_POSITIVE_PATTERNS.some(p => lowerMsg.includes(p))
    if (isFalsePositive) {
      console.log(`[useDataError] Erro ignorado (falso positivo) na camada ${camada}:`, mensagem)
      return
    }

    // Ignore errors during the first 4 seconds after mount (startup transients)
    const age = Date.now() - mountedAt.current
    if (age < 4000) {
      console.log(`[useDataError] Erro ignorado (startup ${age}ms) na camada ${camada}:`, mensagem)
      return
    }

    setErrors(prev => {
      // Deduplicate by camada — update existing instead of appending
      const existing = prev.find(e => e.camada === camada)
      if (existing) {
        return prev.map(e =>
          e.camada === camada
            ? { ...e, mensagem, tentativas: e.tentativas + 1, timestamp: Date.now() }
            : e
        )
      }
      return [...prev, { camada, mensagem, timestamp: Date.now(), tentativas: 1 }]
    })
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
