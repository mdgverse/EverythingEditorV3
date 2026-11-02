# Everything Editor v3

Editor gráfico/vetorial em arquivo único (`index.html`, HTML + CSS + JS, sem build).

## 🌐 Usar agora (público)

**https://mdgverse.github.io/EverythingEditorV3/**

Não precisa instalar nada — abre direto no navegador (desktop ou celular).
O app roda 100% no seu dispositivo: os arquivos/projetos não são enviados para servidor nenhum.

## 📄 Arquivo único

| Arquivo | Descrição |
| --- | --- |
| `index.html` | O editor completo (use este arquivo para rodar localmente também) |

Para rodar offline, basta baixar `index.html` e abrir com duplo clique.

## 🔄 Atualização automática

O site é publicado pelo GitHub Pages através do workflow
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml),
que dispara a cada `push` em `main` (ou em branches `arena/**`) e também pode ser
executado manualmente em **Actions → Deploy to GitHub Pages → Run workflow**.

Ou seja: qualquer alteração em `index.html` que chegue ao repositório vira uma nova
versão pública em cerca de 1 minuto, sem passos manuais.

Para publicar uma versão nova manualmente pelo GitHub:

1. Abra `index.html` → **Edit** (lápis) → cole o novo conteúdo → **Commit changes**.
2. Aguarde o check verde em **Actions**.

## ⚙️ Como o Pages está configurado

- Source: **GitHub Actions** (`Settings → Pages → Build and deployment`)
- Site publicado: `https://mdgverse.github.io/EverythingEditorV3/`
