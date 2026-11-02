# Mantém a ponte JavaScript -> Java (sem isso o R8 pode renomear/remover os métodos)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class br.com.mdgverse.everythingeditor.** { *; }
