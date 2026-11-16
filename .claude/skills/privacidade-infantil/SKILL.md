---
name: privacidade-infantil
description: Regras de privacidade e segurança para jogos infantis do queres.games (LGPD, crianças). Use SEMPRE que o jogo for coletar, guardar, enviar ou mostrar algo sobre jogadores: nome, conta, login, ranking, chat, multiplayer online, formulário, texto digitado, localização, foto, servidor ou rede.
---

<!-- versao-modelo: 2026-11-16.1 (vem do repositório deadnessus/queres-games, pasta modelo-jogos/) -->

# Privacidade infantil no queres.games

Quem joga são crianças. Na dúvida, **não colete e pergunte ao dono** (o pai do Jojô e do Bento).

## Nunca
- Pedir ou guardar **nome real, e-mail, telefone, endereço, idade, foto, localização**.
- **Chat** ou conversa livre entre jogadores (nem escondido, nem "só amigos").
- Enviar a um servidor **texto livre** digitado pela criança.
- **Analytics ou rastreadores próprios**, anúncios, pixels, cookies de medição.
- Carregar **fontes, bibliotecas ou imagens de outros sites** (Google Fonts, CDN): o endereço (IP) da criança vai para terceiros. Guarde tudo dentro do jogo.
- Misturar medições com a conta de apelido.

## Pode
- **Salvar progresso no próprio aparelho** (`localStorage`), com chaves suas (`removeItem`; nunca `localStorage.clear()`).
- Nome do personagem ou do time **só no aparelho** (não envie).
- **Conta do site**: um apelido gerado ("Lobo Azul") e um código de 3 caracteres, sem nome, e-mail nem senha. Compartilhada por todos os jogos (cookie do site). Use o cliente pronto:
  ```html
  <script src="/conta.js?v=2"></script>
  ```
  e `QGConta.me()`, `QGConta.entrar()`, `QGConta.montar(elemento, ...)`, `QGConta.perfil()`. **Não faça telas de login próprias.** Ranking e dados por jogador precisam de função no servidor do site: peça ao dono para fazer na sessão do repositório `queres-games` (skill `login-queres-games` de lá).
- **Online entre jogadores**: por **código de sala**, sem chat, mostrando só o apelido da conta.
- Medição **anônima do site**: só somas (ver `telemetria-queres-games`).

## Antes de publicar
Rode o verificador (`preparar-jogo-para-queres-games`): ele avisa campo de e-mail/telefone, chat, endereços externos e analytics. Explique cada aviso ao dono.
