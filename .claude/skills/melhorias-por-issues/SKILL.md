---
name: melhorias-por-issues
description: Como transformar o que os números do painel do queres.games mostram (botões que ninguém usa, erros, pessoas que desistem) em issues claras neste repositório, sem mexer no jogo antes da aprovação. Use ao receber "melhorar o jogo com base nos números", "olhar o painel", "sugerir melhorias" ou ao rodar uma rotina de análise.
---

<!-- versao-modelo: 2026-11-16.1 (vem do repositório deadnessus/queres-games, pasta modelo-jogos/) -->

# Melhorias por issues

**Sugestões de melhoria ficam nas issues do repositório do jogo.** Ninguém muda o jogo por causa de um número sem que o dono (ou o Jojô/o Bento) aprove a issue.

## De onde vêm os números
O resumo protegido do site: `GET https://queres.games/api/painel/resumo?jogo=<nome-do-jogo>&dias=14`. Ele traz, por **versão** do jogo: sessões, tempo médio, saída rápida, erros, aparelhos, retorno, botões usados e "nunca clicados" e eventos. Só somas, nunca dados de pessoas. O acesso usa uma chave que só o dono tem; **nunca** peça nem guarde a chave. Se a sessão não tiver acesso, peça ao dono para mostrar o painel (`queres.games/painel`) ou colar o resumo.

## Como ler (sem se enganar)
- Com **menos de 30 sessões** (`amostra_pequena`), não conclua nada.
- "Nunca clicado" pode ser só uma tela que ninguém alcançou: olhe as sessões e o funil.
- Compare **versões** (antes e depois de uma mudança), não dias soltos.
- Botões criados por JavaScript só aparecem depois de usados; gestos no canvas não são medidos.

## Como escrever a issue
Uma issue por problema, em português simples. Modelo:

```
Título: <o que acontece, em poucas palavras>

O que os números mostram
- Jogo e versão (commit): ...
- Período e tamanho da amostra: ... sessões
- Número: ... (ex.: 60% saem em menos de 10 s; o botão X teve 0 cliques em 200 sessões)

Por que importa
- ...

Ideia do que mudar
- ... (uma frase, sem implementar)

Como saber se funcionou
- Qual número deve mudar, e para quanto, na próxima versão
```

## Regras
- **Não implemente** sem aprovação da issue.
- Sem dados pessoais nas issues (os números já são anônimos; mantenha assim).
- Não invente causas: separe "o que os números mostram" de "o que eu imagino".
- Depois de aplicar uma melhoria aprovada, peça ao dono para publicar de novo e **olhe a nova versão** no painel.
