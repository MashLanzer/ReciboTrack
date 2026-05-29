import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Términos de Servicio — ReciboTrack",
  description: "Términos y condiciones de uso de ReciboTrack.",
}

export default function TermsPage() {
  const lastUpdated = "28 de mayo de 2026"

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Términos de Servicio</h1>
          <p className="text-muted-foreground text-sm">Última actualización: {lastUpdated}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Aceptación de los términos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Al usar ReciboTrack, aceptas estos Términos de Servicio. Si no estás de acuerdo, no uses la app.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Descripción del servicio</h2>
          <p className="text-muted-foreground leading-relaxed">
            ReciboTrack es una aplicación de gestión de gastos personales que permite escanear recibos mediante OCR, registrar gastos, establecer presupuestos y analizar tus finanzas. El servicio se ofrece en modalidad gratuita y de pago (Pro / Premium).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Uso aceptable</h2>
          <p className="text-muted-foreground leading-relaxed">Te comprometes a:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Usar la app solo para fines legales y personales.</li>
            <li>No compartir tu cuenta con otras personas.</li>
            <li>No intentar acceder a cuentas de otros usuarios.</li>
            <li>No usar la app para actividades fraudulentas o ilegales.</li>
            <li>No sobrecargar nuestros servidores con solicitudes automatizadas.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Suscripciones y pagos</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Los planes de pago se cobran de forma mensual o anual según lo seleccionado.</li>
            <li>Los pagos se procesan de forma segura a través de Stripe.</li>
            <li>Puedes cancelar tu suscripción en cualquier momento. La cancelación aplica al final del período facturado.</li>
            <li>No ofrecemos reembolsos por períodos parciales, salvo donde lo exija la ley.</li>
            <li>Nos reservamos el derecho de modificar los precios con previo aviso de 30 días.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Limitación de responsabilidad</h2>
          <p className="text-muted-foreground leading-relaxed">
            ReciboTrack se proporciona "tal cual". No garantizamos que la app esté libre de errores o disponible en todo momento. No somos responsables de pérdidas financieras derivadas del uso de la app. La información proporcionada por el OCR puede contener errores — siempre verifica los datos importantes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Propiedad intelectual</h2>
          <p className="text-muted-foreground leading-relaxed">
            Todos los derechos de ReciboTrack (código, diseño, marca) pertenecen a sus creadores. No puedes copiar, modificar ni redistribuir ninguna parte de la app sin permiso escrito.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Terminación</h2>
          <p className="text-muted-foreground leading-relaxed">
            Nos reservamos el derecho de suspender o eliminar cuentas que violen estos términos. Puedes eliminar tu cuenta en cualquier momento desde la configuración de la app o contactándonos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Cambios a los términos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Podemos actualizar estos términos. Te notificaremos con al menos 15 días de anticipación para cambios significativos. El uso continuado de la app implica aceptación.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Contacto</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para consultas sobre estos términos:{" "}
            <a href="mailto:brayanibarra0105@gmail.com" className="text-primary underline">
              brayanibarra0105@gmail.com
            </a>
          </p>
        </section>

        <footer className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ReciboTrack. Todos los derechos reservados.{" "}
            <a href="/privacy" className="underline hover:text-foreground">Política de Privacidad</a>
          </p>
        </footer>
      </div>
    </div>
  )
}
