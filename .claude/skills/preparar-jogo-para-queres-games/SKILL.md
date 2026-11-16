---
name: preparar-jogo-para-queres-games
description: Prepara e confere um jogo para rodar bem no queres.games (site de jogos infantis do Jojô e do Bento). Use antes de pedir para publicar, ao começar um jogo novo, ao ouvir "subir/publicar no queres.games", "conferir o jogo", "boas práticas" ou "o jogo está pronto?". Roda um verificador automático e traz o checklist.
---

<!-- versao-modelo: 2026-11-16.1 (vem do repositório deadnessus/queres-games, pasta modelo-jogos/) -->

# Preparar o jogo para o queres.games

O jogo roda em `https://queres.games/jogar/<nome-do-jogo>/`. Quem copia o jogo para o site é **outra sessão**, no repositório `deadnessus/queres-games`. Aqui o seu trabalho é deixar o jogo pronto e conferido.

## 1. Rode o verificador (sempre)

```
node .claude/skills/preparar-jogo-para-queres-games/verificar-jogo.mjs <pasta-do-jogo>
```

`<pasta-do-jogo>` é a pasta que tem o `index.html` (por exemplo `.`, `public` ou o nome da pasta do jogo). Ele mostra:

- **ERRO**: conserte antes de publicar.
- **AVISO**: confira; se decidir manter, explique o motivo ao dono.
- **INFO**: dica.

Mostre o resultado ao dono em linguagem simples. Não esconda avisos.

## 2. Checklist (o verificador não pega tudo)

- **Celular primeiro**: toque funciona, botões grandes, tela de 360 px de largura sem rolagem lateral, em pé e deitado.
- **Tudo dentro da pasta**: bibliotecas (ex.: Three.js) em `vendor/` ou `lib/`, fontes em `fonts/`. Nada de CDN, Google Fonts ou outro site (o jogo quebra sem internet, e fonte do Google entrega o IP das crianças).
- **Caminhos relativos** (`src/main.js`, `./img/a.png`), nunca `/src/main.js`.
- **`index.html` no começo da pasta**, com `<meta charset="utf-8">` e `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- **Som só depois de um toque** (o navegador bloqueia antes) e **pausa** quando a aba esconde (`visibilitychange`).
- **Sem `alert`, `confirm` nem `prompt`**: use uma janela dentro do jogo.
- **Peso**: arquivo de no máximo 25 MB (limite do Cloudflare); quanto menor, melhor no celular.
- **Botões com `id` ou `data-...` claros** (`btn-pausar`): a telemetria de uso de botões usa esses nomes (ver a skill `telemetria-queres-games`).
- **Commit limpo**: a versão do jogo no painel é o commit. Publique de uma branch sem mudanças soltas.

## 3. Regras que nunca mudam (ver `privacidade-infantil`)

- **Não crie analytics próprio.** O site mede sozinho e de forma anônima.
- **Sem chat** entre jogadores, **sem dado pessoal**, **sem texto livre enviado a servidor**.
- Login/ranking só pela conta do site (`/conta.js`), nunca telas de login próprias.

## 4. Como o jogo vai para o site

1. Deixe o jogo commitado e diga ao dono: "pronto para publicar".
2. O dono pede a publicação numa sessão do repositório `queres-games`, que copia os arquivos, grava a **versão** (`versao.json` com o commit) e abre o PR.
3. Se mexer na telemetria ou nos eventos depois, é preciso publicar de novo (a lista de eventos é lida na publicação).

Não abra PR no repositório do site por conta própria.
