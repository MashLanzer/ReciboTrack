import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

export async function GET() {
  return NextResponse.json({ challenge: randomUUID() })
}
