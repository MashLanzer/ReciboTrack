import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Política de Privacidad — ReciboTrack",
  description: "Cómo recopilamos, usamos y protegemos tu información en ReciboTrack.",
}

export default function PrivacyPage() {
  const lastUpdated = "28 de mayo de 2026"

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Política de Privacidad</h1>
          <p className="text-muted-foreground text-sm">Última actualización: {lastUpdated}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Información que recopilamos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Recopilamos la siguiente información cuando usas ReciboTrack:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li><strong>Datos de cuenta:</strong> nombre, dirección de correo electrónico y foto de perfil proporcionados al registrarte.</li>
            <li><strong>Datos financieros:</strong> gastos, montos, categorías, comercios y notas que ingresas manualmente en la app.</li>
            <li><strong>Imágenes de recibos:</strong> fotos que capturas o subes para escanear mediante OCR. Las imágenes se procesan y pueden almacenarse en nuestros servidores.</li>
            <li><strong>Datos de uso:</strong> información técnica como tipo de dispositivo, sistema operativo y errores de la app, para mejorar el servicio.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Cómo usamos tu información</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Proporcionar y mejorar las funcionalidades de la app.</li>
            <li>Procesar recibos mediante reconocimiento óptico de caracteres (OCR).</li>
            <li>Enviar notificaciones de pagos recurrentes si las activas.</li>
            <li>Procesar pagos de suscripción a través de Stripe (no almacenamos datos de tarjetas).</li>
            <li>Cumplir con obligaciones legales aplicables.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Compartición de datos con terceros</h2>
          <p className="text-muted-foreground leading-relaxed">
            Compartimos datos únicamente con los siguientes proveedores de servicio, que actúan como encargados del tratamiento:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li><strong>Firebase (Google):</strong> autenticación de usuarios.</li>
            <li><strong>Supabase:</strong> almacenamiento de base de datos (alojado en AWS).</li>
            <li><strong>Stripe:</strong> procesamiento de pagos de suscripción.</li>
            <li><strong>Google Gemini / Groq:</strong> procesamiento de imágenes para OCR. Las imágenes se envían de forma segura y no se usan para entrenar modelos.</li>
            <li><strong>Vercel:</strong> infraestructura de la aplicación web.</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            No vendemos ni cedemos tu información personal a terceros con fines comerciales.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Retención y eliminación de datos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Conservamos tus datos mientras mantengas una cuenta activa. Puedes solicitar la eliminación de tu cuenta y todos tus datos contactándonos en{" "}
            <a href="mailto:brayanibarra0105@gmail.com" className="text-primary underline">
              brayanibarra0105@gmail.com
            </a>
            . Procesaremos tu solicitud en un plazo máximo de 30 días.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Seguridad</h2>
          <p className="text-muted-foreground leading-relaxed">
            Usamos medidas de seguridad estándar de la industria: conexiones HTTPS cifradas, autenticación segura mediante Firebase, y almacenamiento en bases de datos protegidas. Ningún sistema es 100% seguro, pero tomamos medidas razonables para proteger tu información.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Tus derechos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Tienes derecho a acceder, corregir, exportar o eliminar tus datos personales. Para ejercer estos derechos, contáctanos en{" "}
            <a href="mailto:brayanibarra0105@gmail.com" className="text-primary underline">
              brayanibarra0105@gmail.com
            </a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Cambios a esta política</h2>
          <p className="text-muted-foreground leading-relaxed">
            Podemos actualizar esta política periódicamente. Te notificaremos de cambios significativos a través de la app o por correo electrónico. El uso continuado de la app tras los cambios constituye tu aceptación.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Contacto</h2>
          <p className="text-muted-foreground leading-relaxed">
            Si tienes preguntas sobre esta política, contáctanos en:{" "}
            <a href="mailto:brayanibarra0105@gmail.com" className="text-primary underline">
              brayanibarra0105@gmail.com
            </a>
          </p>
        </section>

        <footer className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ReciboTrack. Todos los derechos reservados.{" "}
            <a href="/terms" className="underline hover:text-foreground">Términos de Servicio</a>
          </p>
        </footer>
      </div>
    </div>
  )
}
