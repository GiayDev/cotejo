import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docx, paragrafo } from './ajudantes.mjs';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'cotejo.mjs');

function rodar(args, cwd) {
  const p = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { codigo: p.status, saida: p.stdout, erro: p.stderr };
}

function pasta() {
  return mkdtempSync(join(tmpdir(), 'cotejo-'));
}

test('arquivo correto sai com 0', () => {
  const d = pasta();
  writeFileSync(join(d, 'a.txt'), 'R$ 100,00 (cem reais)');
  const r = rodar(['a.txt'], d);
  assert.equal(r.codigo, 0);
  assert.match(r.saida, /1 valor\(es\) conferido\(s\) em 1 arquivo\(s\): 0 divergência/);
  rmSync(d, { recursive: true });
});

test('divergência sai com 1 e mostra arquivo:linha:coluna e o esperado', () => {
  const d = pasta();
  writeFileSync(join(d, 'c.md'), 'linha 1\nA multa é R$ 100,00 (mil reais).\n');
  const r = rodar(['c.md'], d);
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /^c\.md:2:11 {2}DIVERGE {2}R\$ 100,00 {2}\(o extenso lê R\$ 1\.000,00\)/m);
  assert.match(r.saida, /esperado: cem reais/);
  rmSync(d, { recursive: true });
});

test('ilegível só reprova com --estrito', () => {
  const d = pasta();
  writeFileSync(join(d, 'm.txt'), 'R$ 1,00 (valor por extenso)');
  assert.equal(rodar(['m.txt'], d).codigo, 0);
  assert.equal(rodar(['--estrito', 'm.txt'], d).codigo, 1);
  rmSync(d, { recursive: true });
});

test('pasta é percorrida, node_modules e .git são ignorados, docx é lido', () => {
  const d = pasta();
  mkdirSync(join(d, 'sub'));
  mkdirSync(join(d, 'node_modules'));
  mkdirSync(join(d, '.git'));
  writeFileSync(join(d, 'sub', 'contrato.docx'), docx(paragrafo('R$ 20,00 (dez reais)')));
  writeFileSync(join(d, 'node_modules', 'x.txt'), 'R$ 1,00 (dois reais)');
  writeFileSync(join(d, '.git', 'y.txt'), 'R$ 1,00 (dois reais)');
  writeFileSync(join(d, 'ignorado.bin'), 'R$ 1,00 (dois reais)');
  const r = rodar(['--json', '.'], d);
  assert.equal(r.codigo, 1);
  const j = JSON.parse(r.saida);
  assert.equal(j.arquivos.length, 1);
  assert.match(j.arquivos[0].arquivo, /contrato\.docx$/);
  assert.equal(j.divergencias, 1);
  rmSync(d, { recursive: true });
});

test('latin1 legado é lido', () => {
  const d = pasta();
  writeFileSync(join(d, 'l.txt'), Buffer.from('R$ 3,00 (tr\xeas reais)', 'latin1'));
  const r = rodar(['l.txt'], d);
  assert.equal(r.codigo, 0);
  assert.match(r.saida, /1 valor/);
  rmSync(d, { recursive: true });
});

test('erros de uso e de leitura saem com 2', () => {
  const d = pasta();
  assert.equal(rodar([], d).codigo, 2);
  assert.equal(rodar(['--nada'], d).codigo, 2);
  const r = rodar(['nao-existe.txt'], d);
  assert.equal(r.codigo, 2);
  assert.match(r.erro, /nao-existe\.txt: não existe/);
  writeFileSync(join(d, 'ruim.docx'), 'não sou zip');
  const q = rodar(['ruim.docx'], d);
  assert.equal(q.codigo, 2);
  assert.match(q.erro, /ruim\.docx: .*zip/);
  rmSync(d, { recursive: true });
});

test('ajuda e versão', () => {
  assert.match(rodar(['--ajuda']).saida, /uso: cotejo/);
  assert.match(rodar(['--versao']).saida, /^0\.1\.0/);
});
