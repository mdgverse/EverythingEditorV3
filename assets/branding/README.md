# Marca — Ouroboros Editor

## Asset oficial (recebido em 2026-11-02)

A arte enviada pelo usuário (cobra Ouroboros verde em forma de infinito sobre
fundo preto, 1024×1024) é a fonte de todos os ícones:

| Arquivo | Uso |
| --- | --- |
| `ouroboros-icon-1024.png` | fonte oficial 1024×1024 (base de todos os tamanhos) |
| `icon-512.png` | favicon principal (`<link rel="icon">` no `index.html`) |
| `icon-192.png` | `shortcut icon` |
| `icon-180.png` | `apple-touch-icon` |
| `icon-32.png` | tamanho pequeno de reserva |

No Android, os PNGs gerados a partir da mesma fonte vivem em
`android/app/src/main/res/mipmap-*dpi/` (`ic_launcher_foreground.png` com a
arte a 78% sobre preto — zona segura do adaptive icon — e os legados
`ic_launcher.png`/`ic_launcher_round.png`), referenciados por
`mipmap-anydpi-v26/ic_launcher.xml` sobre `@color/ic_launcher_background`
(`#000000`, o mesmo preto da arte). O APK empacota `index.html` + `assets/`
automaticamente (`copyWebApp` no `build.gradle`), então os favicons acima
valem para o site e para o app.

Para regenerar: redimensionar `ouroboros-icon-1024.png` (web: 512/192/180/32
cheios; Android foreground: 108/162/216/324/432 com arte a 78% centrada sobre
preto; legado: 48/72/96/144/192 cheios).

## O que NÃO muda com a marca

- `applicationId` Android: `br.com.mdgverse.everythingeditor` (atualização por cima
  da instalação atual, sem desinstalar);
- chave de assinatura: `android/app/keystore/release.jks` e a configuração de
  assinatura existente — nunca regenerar nem substituir;
- dados do usuário: nomes de IndexedDB/localStorage (`everything-editor-*`) e o
  formato dos projetos/backups continuam os mesmos;
- a hashtag da comunidade `#everythingeditor` — é o identificador dos posts já
  publicados, não texto de marca;
- a URL do site mudou por decisão do usuário em 2026-11-02: o repositório foi
  renomeado para `OuroborosEditor` (`mdgverse.github.io/OuroborosEditor/`), e os
  links internos (README, `CMTY_PAGES`, feed) foram atualizados junto.
