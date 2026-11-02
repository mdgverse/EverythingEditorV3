# Everything Editor v3

Editor gráfico/vetorial em **arquivo único** (`index.html`, HTML + CSS + JS, sem build) com
versão web e **app Android (APK)**.

## 🌐 Usar no navegador

**https://mdgverse.github.io/EverythingEditorV3/**

## 📱 Baixar o APK (Android 10+)

**[⬇️ EverythingEditor.apk](https://github.com/mdgverse/EverythingEditorV3/releases/download/apk-latest/EverythingEditor.apk)**

1. Abra o link no celular e baixe o arquivo.
2. Toque no APK e permita **“instalar apps desconhecidos”** para o navegador/gerenciador de arquivos.
3. Pronto — o app abre offline, sem pedir nenhuma permissão.

> O arquivo desta Release é **substituído a cada nova versão** (mesmo link sempre).
> A atualização instala por cima da anterior, preservando os projetos salvos no aparelho.

## 📲 O app Android

| Item | Valor |
| --- | --- |
| Pacote | `br.com.mdgverse.everythingeditor` |
| Versão mínima | Android 10 (API 29) |
| Alvo | Android 15 (API 35) |
| Tamanho | ~2 MB |
| Internet | **não usa** (o app não pede permissão de rede) |
| Onde salva | `Downloads/Everything Editor/` |
| Interface | camada mobile própria: barra inferior, bottom sheets, gestos (pinça para zoom, toque duplo para enquadrar, toque longo no fundo para adicionar nó) |

**Como o app funciona:** uma casca Android nativa minimalista (`WebView` + assets locais)
serve o `index.html` empacotado no APK a partir de uma origem `https` sintética
(`appassets.androidplatform.net`), o que mantém `localStorage`/IndexedDB/canvas funcionando
com contexto seguro. Sem frameworks, sem bibliotecas externas.

A ponte JavaScript ↔ Android (`android/app/src/main/java/.../SaveBridge.java`) expõe
`window.AndroidSave` (`begin` / `chunk` / `end`) — é o que faz “Exportar PNG”, “Salvar grafo”
e as exportações de vídeo caírem em Downloads. O botão **Voltar** do Android fecha painéis e
menus antes de sair (`window.__eeAndroidBack` em `index.html`).

## 🔄 Atualização automática

| O que muda | O que acontece |
| --- | --- |
| `index.html` (ou `android/**`) entra na `main` | `.github/workflows/build-apk.yml` compila **APK + AAB** e publica na Release `apk-latest` |
| `index.html` entra na `main` | GitHub Pages (publicando da branch `main`, pasta raiz) republica o site |

Para gerar um APK manualmente: **Actions → Build APK → Run workflow**.

## 🗂 Estrutura

```
index.html                      editor completo (web + app)
.github/workflows/build-apk.yml build do APK/AAB e publicação na Release
android/                        projeto Android (Gradle + Java, sem dependências)
  app/src/main/java/...          MainActivity (WebView) e SaveBridge (arquivos)
  app/src/main/res/              ícone, tema
  app/build.gradle               minSdk 29, targetSdk 35, assinatura
```

O `index.html` **não é duplicado**: a tarefa Gradle `copyWebApp` copia o arquivo da raiz
para `assets/` em todo build.

## 🛠 Compilar localmente

```bash
# precisa de JDK 17 + Android SDK 35
cd android
gradle assembleRelease     # APK em app/build/outputs/apk/release/
```

Na primeira vez, a chave de assinatura precisa existir (`android/app/keystore/release.jks`).
O CI a cria e commita automaticamente; para criar à mão:

```bash
keytool -genkeypair -keystore android/app/keystore/release.jks \
  -alias everythingeditor -keyalg RSA -keysize 2048 -validity 10950 \
  -storepass everythingeditor -keypass everythingeditor \
  -dname "CN=Everything Editor, O=mdgverse, C=BR"
```

> ⚠️ A senha da keystore é pública (está no workflow) — é uma assinatura de **sideload**.
> Para publicar na Play Store, gere uma keystore privada e guarde-a em *secrets*.
