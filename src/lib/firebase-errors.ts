/**
 * Traduce códigos de error de Firebase Auth a mensajes en español amigables.
 */
export function getFirebaseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code ?? ""
    const messages: Record<string, string> = {
      "auth/user-not-found":           "No existe una cuenta con ese correo.",
      "auth/wrong-password":           "Contraseña incorrecta.",
      "auth/invalid-credential":       "Credenciales inválidas. Verifica tu correo y contraseña.",
      "auth/email-already-in-use":     "Ya existe una cuenta con ese correo.",
      "auth/weak-password":            "La contraseña debe tener al menos 6 caracteres.",
      "auth/invalid-email":            "El formato del correo no es válido.",
      "auth/too-many-requests":        "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
      "auth/network-request-failed":   "Sin conexión. Verifica tu red.",
      "auth/popup-closed-by-user":     "Ventana cerrada antes de completar el inicio de sesión.",
      "auth/cancelled-popup-request":  "Solicitud de inicio de sesión cancelada.",
      "auth/requires-recent-login":    "Por seguridad, vuelve a iniciar sesión antes de continuar.",
      "auth/user-disabled":            "Esta cuenta ha sido deshabilitada.",
      "auth/operation-not-allowed":    "Este método de inicio de sesión no está habilitado.",
      "auth/account-exists-with-different-credential": "Ya existe una cuenta con ese correo usando otro método de inicio de sesión.",
      "auth/credential-already-in-use": "Estas credenciales ya están vinculadas a otra cuenta.",
      "permission-denied":             "No tienes permisos para realizar esta acción.",
      "unavailable":                   "Servicio no disponible. Verifica tu conexión.",
      "not-found":                     "El recurso solicitado no existe.",
    }
    if (code && messages[code]) return messages[code]
    // Firebase sometimes puts the code in the message
    for (const [k, v] of Object.entries(messages)) {
      if (error.message.includes(k)) return v
    }
    return error.message || "Ha ocurrido un error inesperado."
  }
  return "Ha ocurrido un error inesperado."
}
