# Marca — Ouroboros Editor

## Asset esperado (ainda não fornecido)

O ícone oficial do **Ouroboros Editor** deve ser colocado nesta pasta:

| Arquivo | Uso |
| --- | --- |
| `ouroboros-icon.svg` | fonte vetorial do ícone (favicon e base para os demais) |
| `ouroboros-icon-1024.png` | PNG 1024×1024 para gerar os tamanhos do Android/PWA |

**Não desenhar um substituto à mão.** Enquanto o arquivo oficial não estiver aqui,
o app continua com o ícone atual (o símbolo de infinito), que já está ligado em:

- `index.html` — `<link rel="icon">`, `<link rel="shortcut icon">` e
  `<link rel="apple-touch-icon">` (SVG embutido no `<head>`);
- `android/app/src/main/res/drawable/ic_launcher_foreground.xml` — foreground do
  adaptive icon (`android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`),
  sobre `@color/ic_launcher_background`.

## Quando o asset chegar

1. Trocar os três `href` de ícone no `<head>` do `index.html` pelo novo SVG/PNG.
2. Regenerar o foreground do adaptive icon a partir do SVG (vector drawable ou
   mipmaps PNG por densidade), mantendo `@mipmap/ic_launcher` no manifesto.
3. Conferir o ícone no launcher Android e na aba do navegador.

## O que NÃO muda com a marca

- `applicationId` Android: `br.com.mdgverse.everythingeditor` (atualização por cima
  da instalação atual, sem desinstalar);
- chave de assinatura: `android/app/keystore/release.jks` e a configuração de
  assinatura existente — nunca regenerar nem substituir;
- dados do usuário: nomes de IndexedDB/localStorage (`everything-editor-*`) e o
  formato dos projetos/backups continuam os mesmos;
- a hashtag da comunidade `#everythingeditor` e a URL do site
  (`mdgverse.github.io/EverythingEditorV3/`) — são identificadores dos posts e do
  endereço já publicados, não texto de marca.
