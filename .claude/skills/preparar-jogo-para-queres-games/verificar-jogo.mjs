#!/usr/bin/env node
// Verificador de jogo para o queres.games. Lê a pasta do jogo (a que tem o index.html) e aponta problemas
// antes de publicar. Não precisa instalar nada (só Node 18+).
//
// Uso:  node verificar-jogo.mjs <pasta-do-jogo>
//   ex.: node .claude/skills/preparar-jogo-para-queres-games/verificar-jogo.mjs .
//        node .claude/skills/preparar-jogo-para-queres-games/verificar-jogo.mjs public
// Resultado: ERRO (conserte antes de publicar), AVISO (confira) e INFO (dica). Sai com código 1 se houver ERRO.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, extname, basename } from 'node:path';

const pasta = resolve(process.argv[2] || '.');
if (!existsSync(pasta) || !statSync(pasta).isDirectory()) { console.error('Uso: node verificar-jogo.mjs <pasta-do-jogo>'); process.exit(2); }

const IGNORAR = new Set(['.git', 'node_modules', 'dist', '.claude', 'tests', 'test', 'docs', '__pycache__']);
const TERCEIROS = new Set(['vendor', 'lib', 'fonts']); // bibliotecas e fontes guardadas no jogo: não entram nas buscas de texto
const TEXTO = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg']);
const achados = [];
const add = (nivel, regra, msg, onde) => achados.push({ nivel, regra, msg, onde });

function listar(dir, acc = [], terceiros = false) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(d.name)) continue;
    const caminho = join(dir, d.name);
    if (d.isDirectory()) listar(caminho, acc, terceiros || TERCEIROS.has(d.name));
    else acc.push({ caminho, rel: relative(pasta, caminho), terceiro: terceiros, tam: statSync(caminho).size });
  }
  return acc;
}
const arquivos = listar(pasta);
const proprios = arquivos.filter((a) => !a.terceiro && TEXTO.has(extname(a.rel).toLowerCase()) && a.tam < 3_000_000);
const lido = new Map();
const ler = (a) => { if (!lido.has(a.caminho)) lido.set(a.caminho, readFileSync(a.caminho, 'utf8')); return lido.get(a.caminho); };
const linhaDe = (texto, indice) => texto.slice(0, indice).split('\n').length;
const ehComentario = (linha) => /^\s*(\/\/|\/\*|\*|#|<!--)/.test(linha);

// ---------- index.html ----------
const index = arquivos.find((a) => a.rel === 'index.html');
if (!index) {
  add('ERRO', 'index', 'Não achei o index.html nesta pasta. Rode o verificador na pasta que tem o index.html (ex.: "public" ou o nome da pasta do jogo).', '');
} else {
  const html = ler(index);
  if (!/<meta[^>]+charset\s*=/i.test(html.slice(0, 1024))) add('ERRO', 'charset', 'Falta <meta charset="utf-8"> logo no começo do index.html (nos primeiros 1000 caracteres). Sem isso os acentos quebram ("BrasileirÃ£o").', 'index.html:1');
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) add('AVISO', 'viewport', 'Falta <meta name="viewport" content="width=device-width, initial-scale=1"> no index.html: no celular o jogo aparece como tela de computador, pequeno.', 'index.html:1');
  if (!/<title>[^<]+<\/title>/i.test(html)) add('AVISO', 'titulo', 'Falta o <title> do jogo.', 'index.html:1');
  if (!/<html[^>]*\blang=/i.test(html)) add('INFO', 'lang', 'Dica: <html lang="pt-BR"> ajuda leitores de tela e corretores.', 'index.html:1');
}

// ---------- tamanho e arquivos que não devem subir ----------
for (const a of arquivos) {
  if (a.tam > 25 * 1024 * 1024) add('ERRO', 'tamanho', `Arquivo com ${(a.tam / 1048576).toFixed(1)} MB: o Cloudflare Pages só aceita arquivos de até 25 MB.`, a.rel);
  else if (a.tam > 5 * 1024 * 1024) add('AVISO', 'tamanho', `Arquivo grande (${(a.tam / 1048576).toFixed(1)} MB): demora para carregar no celular.`, a.rel);
  if (/^\.env/.test(basename(a.rel)) || /\.(pem|key|p12)$/i.test(a.rel) || /id_rsa/.test(a.rel)) add('ERRO', 'segredo', 'Parece um arquivo de segredo/chave. Nunca publique isto.', a.rel);
}
const total = arquivos.reduce((s, a) => s + a.tam, 0);
if (total > 100 * 1024 * 1024) add('AVISO', 'tamanho', `A pasta tem ${(total / 1048576).toFixed(0)} MB no total: muito pesada para um jogo de navegador.`, '');

// ---------- buscas nos arquivos do jogo ----------
const ANALYTICS = /(google-analytics|googletagmanager|gtag\s*\(|\bga\s*\(\s*['"]create|analytics\.js|plausible\.io|hotjar|mixpanel|segment\.(io|com)|clarity\.ms|matomo|posthog|fullstory|amplitude\.com|sentry\.io|bugsnag|connect\.facebook\.net|\bfbq\s*\()/i;
const HOSTS_OK = /^(www\.w3\.org|localhost|127\.0\.0\.1|queres\.games|www\.queres\.games|example\.com|schema\.org)$/i;
const externos = new Map();
for (const a of proprios) {
  const texto = ler(a); const linhas = texto.split('\n'); const ext = extname(a.rel).toLowerCase();
  const eCodigo = ['.html', '.htm', '.js', '.mjs'].includes(ext);
  let nAnal = 0, nChat = 0;
  linhas.forEach((linha, i) => {
    if (ehComentario(linha)) return;
    const l = linha.length > 600 ? linha.slice(0, 600) : linha;
    // analytics
    if (eCodigo && nAnal < 3 && ANALYTICS.test(l)) { nAnal++; add('ERRO', 'analytics', 'Medição própria (analytics/rastreador). O queres.games já mede tudo sozinho e de forma anônima: remova.', `${a.rel}:${i + 1}`); }
    // endereços externos
    for (const m of l.matchAll(/\b(https?|wss?):\/\/([a-z0-9.-]+)/gi)) {
      if (HOSTS_OK.test(m[2])) continue;
      const lista = externos.get(m[2]) || []; if (lista.length < 3) lista.push(`${a.rel}:${i + 1}`); externos.set(m[2], lista);
    }
    // caminhos absolutos
    if (['.html', '.htm', '.css', '.webmanifest'].includes(ext)) {
      const abs = l.match(/(?:\b(?:src|href|action)=["']|url\(\s*["']?)\/(?!\/)([^"')\s]*)/i);
      if (abs && !/^(conta\.js|favicon)/.test(abs[1]) && !/^api\//.test(abs[1])) add('AVISO', 'caminho', `Caminho absoluto ("/${abs[1]}"): no site o jogo roda em /jogar/<nome>/, então use caminho relativo ("${abs[1]}" ou "./${abs[1]}").`, `${a.rel}:${i + 1}`);
    }
    // pop-ups do navegador
    if (eCodigo && /(^|[^.\w])(alert|confirm|prompt)\s*\(/.test(l)) add('AVISO', 'popup', 'alert/confirm/prompt: bloqueiam o jogo e travam em alguns celulares. Use uma janela dentro da página.', `${a.rel}:${i + 1}`);
    // memória do aparelho
    if (eCodigo && /(localStorage|sessionStorage)\.clear\s*\(/.test(l)) add('AVISO', 'storage', 'localStorage/sessionStorage .clear() apaga TUDO do site (inclusive o login e a memória da telemetria). Apague só as suas chaves com removeItem.', `${a.rel}:${i + 1}`);
    // reserva do site
    if (eCodigo && /window\s*\.\s*QG\s*=[^=]/.test(l)) add('ERRO', 'qg', 'window.QG é do queres.games (QG.evento). Não crie nem troque esse nome.', `${a.rel}:${i + 1}`);
    // dados pessoais e chat
    if (ext === '.html' || ext === '.js' || ext === '.mjs') {
      if (/type=["']?(email|tel)["']?/i.test(l) || /autocomplete=["']?(email|tel|street|cc-|given-name|family-name|bday)/i.test(l)) add('AVISO', 'pessoal', 'Campo que pede dado pessoal (e-mail, telefone, endereço...). O site é para crianças: use só a conta de apelido (/conta.js).', `${a.rel}:${i + 1}`);
      if (nChat < 2 && /(id|class)=["'][^"']*\b(chat|mensagens?|msgbox)\b/i.test(l)) { nChat++; add('AVISO', 'chat', 'Parece um chat. Nada de conversa livre entre jogadores no queres.games.', `${a.rel}:${i + 1}`); }
    }
  });
}
for (const [host, onde] of externos) {
  const cdn = /(unpkg|jsdelivr|cdnjs|googleapis|gstatic|cloudflare\.com|bootstrapcdn|fontawesome|cdn\.)/i.test(host);
  add('AVISO', 'externo', cdn
    ? `Carrega algo de "${host}" (biblioteca/fonte de fora). Guarde dentro do jogo (pasta vendor/ ou fonts/): sem internet o jogo quebra, e fontes do Google entregam o IP das crianças.`
    : `Fala com "${host}". Confira se é mesmo necessário (o jogo deve funcionar só com o que está na pasta; conexões entre jogadores só por códigos, sem chat).`, onde.join(', '));
}

// ---------- botões sem nome (para a telemetria de uso de botões) ----------
let semNome = 0; const exemplos = [];
if (index) {
  const html = ler(index).replace(/<script[\s\S]*?<\/script>/gi, (m) => m.replace(/[^\n]/g, ' ')).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  for (const m of html.matchAll(/<(button|summary|select)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
    if (/\bdisabled\b/i.test(m[2])) continue;
    if (/\bid\s*=\s*["'][^"']+["']/i.test(m[2]) || /\bdata-(?!jogo)[a-z-]+\s*=\s*["'][^"']+["']/i.test(m[2])) continue;
    semNome++; if (exemplos.length < 4) exemplos.push(`index.html:${linhaDe(html, m.index)}`);
  }
}
if (semNome) add('INFO', 'botoes', `${semNome} botão(ões) do index.html sem id nem data-...: no painel eles aparecem como "pai>button". Dê um id claro (ex.: btn-pausar).`, exemplos.join(', '));

// ---------- eventos da telemetria ----------
let raiz = pasta;
while (!existsSync(join(raiz, 'qg-eventos.json')) && !existsSync(join(raiz, '.git')) && dirname(raiz) !== raiz) raiz = dirname(raiz);
const arqEventos = join(raiz, 'qg-eventos.json');
let permitidos = null;
const arqVersao = join(pasta, 'versao.json'); // na cópia que está no site, a lista vem do versao.json (gravado na publicação)
if (!existsSync(arqEventos) && existsSync(arqVersao)) {
  try { const v = JSON.parse(readFileSync(arqVersao, 'utf8')); if (Array.isArray(v.eventos)) permitidos = v.eventos.map(String); } catch { /* ignora */ }
}
if (existsSync(arqEventos)) {
  try {
    const j = JSON.parse(readFileSync(arqEventos, 'utf8')); const lista = Array.isArray(j) ? j : j.eventos;
    if (!Array.isArray(lista)) throw new Error('falta a lista "eventos"');
    permitidos = lista.map(String);
    const ruins = permitidos.filter((n) => !/^[a-z][a-z0-9_]{1,31}$/.test(n));
    if (ruins.length) add('ERRO', 'eventos', `Nome(s) de evento inválido(s): ${ruins.join(', ')}. Use minúsculas, números e _ (2 a 32 letras).`, 'qg-eventos.json');
    if (permitidos.length > 12) add('ERRO', 'eventos', 'No máximo 12 nomes de evento por jogo.', 'qg-eventos.json');
  } catch (e) { add('ERRO', 'eventos', `qg-eventos.json inválido: ${e.message}`, 'qg-eventos.json'); }
}
const usados = new Map();
for (const a of proprios) {
  if (!['.html', '.js', '.mjs'].includes(extname(a.rel).toLowerCase())) continue;
  const texto = ler(a);
  for (const m of texto.matchAll(/QG\s*\??\.\s*evento\s*\??\.?\s*\(\s*['"]([^'"]+)['"]/g)) if (!usados.has(m[1])) usados.set(m[1], `${a.rel}:${linhaDe(texto, m.index)}`);
}
for (const [nome, onde] of usados) {
  if (permitidos === null) add('ERRO', 'eventos', `QG.evento('${nome}') sem o arquivo qg-eventos.json na raiz do repositório: o site ignora o evento.`, onde);
  else if (!permitidos.includes(nome)) add('ERRO', 'eventos', `QG.evento('${nome}') não está em qg-eventos.json: o site ignora o evento.`, onde);
}
if (permitidos) for (const n of permitidos) if (!usados.has(n) && usados.size) add('INFO', 'eventos', `"${n}" está em qg-eventos.json mas nenhuma chamada QG.evento('${n}') foi encontrada (se o nome é montado por código, ignore).`, 'qg-eventos.json');

// ---------- pausa ao esconder a aba ----------
const temPausa = proprios.some((a) => /visibilitychange|pagehide|document\.hidden/.test(ler(a)));
if (index && !temPausa) add('INFO', 'pausa', 'Dica: pause o jogo (e o som) quando a aba esconde (document.addEventListener("visibilitychange", ...)). No celular a criança troca de app o tempo todo.', '');

// ---------- relatório ----------
const ordem = { ERRO: 0, AVISO: 1, INFO: 2 };
achados.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
console.log(`Verificando: ${pasta}  (${arquivos.length} arquivos)\n`);
for (const nivel of ['ERRO', 'AVISO', 'INFO']) {
  const lista = achados.filter((x) => x.nivel === nivel);
  if (!lista.length) continue;
  console.log(`== ${nivel} (${lista.length})`);
  for (const x of lista) console.log(`  [${x.regra}] ${x.msg}${x.onde ? `\n      em ${x.onde}` : ''}`);
  console.log('');
}
const n = (v) => achados.filter((x) => x.nivel === v).length;
console.log(`Resumo: ${n('ERRO')} erro(s), ${n('AVISO')} aviso(s), ${n('INFO')} dica(s).${n('ERRO') ? ' Conserte os ERROS antes de publicar.' : n('AVISO') ? ' Sem erros: confira os avisos.' : ' Tudo certo!'}`);
process.exit(n('ERRO') ? 1 : 0);
