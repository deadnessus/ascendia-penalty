# queres.games: medição de uso e melhorias

Este jogo é publicado em https://queres.games/jogar/ascendia-penaltys/ por outro repositório (`deadnessus/queres-games`).

**A telemetria é automática pelo site.** O site mede, de forma anônima, sessões, tempo de uso, erros de JavaScript, celular ou computador, tamanho de tela e se o aparelho volta em outro dia, e marca tudo com a versão do jogo.
- **Não crie analytics próprio** neste jogo: nada de Google Analytics, contadores, `fetch` para servidores de medição, cookies de medição, nem identificador de jogador. É um site para crianças (LGPD): não coletamos nome, e-mail, IP nem texto livre.
- **Não precisa importar nenhum script de medição.** Não mexa em `/telemetria.js`.
- Erros de JavaScript já são registrados sozinhos. Não esconda erros com `try/catch` vazio só para o console ficar limpo.

**Avisar um acontecimento do jogo (opcional)**, para ver depois onde as crianças travam ou desistem:

```js
window.QG?.evento?.('fase_concluida', { fase: 3 });
```

Regras:
1. O nome precisa estar na lista do arquivo `qg-eventos.json`, na **raiz** deste repositório, assim: `{ "eventos": ["fase_concluida", "jogo_perdido"] }` (até 12 nomes; letras minúsculas, números e `_`; 2 a 32 letras). Nome fora da lista é ignorado. A lista só vale depois da próxima publicação do jogo no site.
2. Dados: no máximo 2 pares. Valor é número inteiro ou palavra curta (até 16 letras/números). **Nunca** nome de pessoa, texto digitado, e-mail ou qualquer coisa que identifique alguém.
3. Use poucos valores diferentes (`fase: 3`, `modo: 'facil'`). **Não** mande pontuação, tempo ou contagem alta como valor: cada valor diferente vira uma linha no banco. Para isso, use faixas (`nivel: 3`).
4. A chamada nunca dá erro e pode ser chamada em qualquer lugar do jogo; fora do site (no seu computador) ela não faz nada.
5. Não altere o jogo para usar eventos sem o pedido de quem manda no jogo.

**Sugestões de melhoria ficam nas issues deste repositório.** Quando alguém (uma pessoa ou uma rotina automática) achar um problema ou uma ideia a partir dos números do site, a sugestão deve virar uma **issue** aqui, escrita em português simples, com: o que foi observado, em qual versão (commit) do jogo, e uma ideia do que mudar. Não faça a mudança sem que alguém aprove a issue.
