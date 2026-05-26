import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid"

// Lazy singleton — instanciado solo cuando llega el primer request.
// Evita crash en build cuando PLAID_CLIENT_ID/SECRET no están definidos.
let _client: PlaidApi | null = null

export function getPlaid(): PlaidApi {
  if (_client) return _client

  const clientId = process.env.PLAID_CLIENT_ID
  const secret   = process.env.PLAID_SECRET
  const env      = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments

  if (!clientId || !secret) {
    throw new Error(
      "[plaid] PLAID_CLIENT_ID y PLAID_SECRET deben estar configurados en variables de entorno",
    )
  }
  if (!(env in PlaidEnvironments)) {
    throw new Error(`[plaid] PLAID_ENV inválido: "${env}". Usa sandbox | development | production`)
  }

  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET":    secret,
      },
    },
  })

  _client = new PlaidApi(config)
  return _client
}

// Productos que la app pide al crear el Link token.
// `transactions` cubre auto-import. Si en el futuro queremos balance en tiempo real,
// añadir `auth` o `balance` requiere re-link del usuario.
export const PLAID_PRODUCTS: Products[] = [Products.Transactions]

// Cobertura: Plaid soporta US/CA + Europa (no LATAM directamente).
// Para usuarios en México/Colombia: futuro Belvo o Salt Edge en Fase 4.
export const PLAID_COUNTRY_CODES: CountryCode[] = [
  CountryCode.Us,
  CountryCode.Ca,
]
