# ── Capacitor core ────────────────────────────────────────────────────────────
# Mantiene todas las clases de Capacitor y sus métodos @PluginMethod anotados
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.PluginMethod *;
}

# ── Cordova bridge ────────────────────────────────────────────────────────────
-keep class org.apache.cordova.** { *; }

# ── Firebase / Google Sign-In ─────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── WebView JS interface ──────────────────────────────────────────────────────
# Capacitor expone un bridge a través de WebView — no ofuscar esa interfaz
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# ── Mantener información de depuración para stack traces legibles ─────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Enums ──────────────────────────────────────────────────────────────────────
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ── Parcelables ────────────────────────────────────────────────────────────────
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# ── Reflection (Gson, etc.) ────────────────────────────────────────────────────
-keepattributes Signature
-keepattributes *Annotation*

# ── OkHttp / Retrofit ─────────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**

# ── Facebook SDK (capacitor-firebase-authentication lo incluye aunque no uses
#    Facebook login — R8 falla buscando estas clases al minificar) ─────────────
-dontwarn com.facebook.**
-keep class com.facebook.** { *; }
