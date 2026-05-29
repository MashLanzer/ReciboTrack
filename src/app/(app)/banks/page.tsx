// Bancos — temporalmente oculto hasta completar integración Plaid/Belvo
// Para reactivar: restaurar el contenido original desde git history
// git show HEAD~10:src/app/(app)/banks/page.tsx

import { redirect } from "next/navigation"

export default function BanksPage() {
  redirect("/dashboard")
}
