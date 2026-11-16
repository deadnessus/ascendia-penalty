---
name: telemetria-queres-games
description: Telemetria anônima do queres.games: o que o site mede sozinho, como dar nomes aos botões e como avisar eventos do jogo com QG.evento e qg-eventos.json. Use quando pedirem "medir", "analytics", "saber se usam o botão", "funil", "eventos", "telemetria" ou "painel" num jogo do queres.games.
---

<!-- versao-modelo: 2026-11-16.1 (vem do repositório deadnessus/queres-games, pasta modelo-jogos/) -->

# Telemetria do queres.games

## O que o site já mede sozinho (você não faz nada)
Sessões, tempo de uso de verdade (aba visível e com toque), erros de JavaScript, celular ou computador, tamanho de tela, aparelho que volta em outro dia, a **versão do jogo** (o commit) e **quantas vezes cada botão é usado** (só pelo nome técnico, nunca pelo texto). Os números vão para o painel do dono (`queres.games/painel`).

**Não crie analytics próprio** (Google Analytics, contadores, `fetch` para medir, cookies): é um site para crianças (LGPD).

## 1. Dê bons nomes aos botões
O painel mostra o `id` do botão (ou o primeiro `data-...`). Então:
- Use nomes claros e estáveis: `btn-pausar`, `btn-jogar-de-novo`, `data-modo="facil"`.
- **Nunca** ponha nome de pessoa, texto digitado ou outro dado pessoal em `id` ou `data-...`.
- Não troque os nomes à toa: quebra a comparação entre versões.
- Campos onde se escreve nunca são contados.

## 2. Avisar acontecimentos do jogo (opcional)
Serve para ver onde as crianças travam ou desistem (um "funil"):

```js
window.QG?.evento?.('fase_concluida', { fase: 3 });
```

**Regras**
1. O nome precisa estar em `qg-eventos.json`, na **raiz do repositório**: `{ "eventos": ["partida_iniciada", "partida_terminada"] }`. No máximo 12 nomes, em minúsculas, números e `_` (2 a 32 letras). Fora da lista é ignorado.
2. Dados: no máximo 2 pares; número inteiro ou palavra curta (até 16 letras/números).
3. **Nunca** nome de pessoa, texto digitado, e-mail, código de sala, apelido, pontuação exata nem tempo exato. Use faixas (`nivel: 3`, `modo: 'facil'`): cada valor diferente vira uma linha no banco.
4. A chamada nunca dá erro e fora do site não faz nada: pode usar à vontade.
5. A lista só vale depois da **próxima publicação** do jogo no site.
6. Só aplique eventos quando o dono pedir; proponha em uma issue antes (skill `melhorias-por-issues`).

**Bons eventos** (poucos, 3 a 6 por jogo): `partida_iniciada`, `partida_terminada` (com `resultado`), `partida_abandonada`, `modo_escolhido`, `ajuda_aberta`, `fase_concluida` (com a faixa da fase).

## 3. Conferir
Rode o verificador da skill `preparar-jogo-para-queres-games`: ele acusa `QG.evento('x')` com nome que não está em `qg-eventos.json`.
