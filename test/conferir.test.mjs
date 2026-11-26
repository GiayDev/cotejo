import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conferir, lerNumero } from '../src/conferir.mjs';
import { textoDeDocx, xmlWordParaTexto } from '../src/ler.mjs';
import { docx, paragrafo, montarZip } from './ajudantes.mjs';

test('par correto', () => {
  const [a] = conferir('O valor é R$ 2.560,00 (dois mil quinhentos e sessenta reais).');
  assert.equal(a.status, 'ok');
  assert.equal(a.linha, 1);
  assert.equal(a.coluna, 11);
});

test('divergência traz o que o extenso lê e o que deveria estar escrito', () => {
  const [a] = conferir('Pagará R$ 1.250,00 (mil duzentos e cinquenta e cinco reais) ao mês.');
  assert.equal(a.status, 'diverge');
  assert.equal(a.detalhe, 'o extenso lê R$ 1.255,00');
  assert.equal(a.sugestao, 'mil duzentos e cinquenta reais');
});

test('erro de ordem de grandeza', () => {
  const [a] = conferir('R$ 10.000,00 (mil reais)');
  assert.equal(a.status, 'diverge');
  assert.equal(a.sugestao, 'dez mil reais');
});

test('centavos divergentes', () => {
  const [a] = conferir('R$ 0,50 (cinco centavos) e R$ 1,05 (um real e cinco centavos) e R$ 3,30 (três reais e trinta centavos)');
  assert.equal(a.status, 'diverge');
});

test('vários pares, linha e coluna corretas, parêntese quebrado em duas linhas', () => {
  const texto = ['Cláusula 1ª', 'preço R$ 100,00 (cem reais)', '', 'multa de R$ 500,00 (quinhentos', 'reais) e juros'].join('\n');
  const achados = conferir(texto);
  assert.equal(achados.length, 2);
  assert.deepEqual(achados.map((a) => [a.linha, a.status]), [[2, 'ok'], [4, 'ok']]);
  assert.equal(achados[1].extenso, 'quinhentos reais');
});

test('extenso com erro de grafia é ilegível, não divergente', () => {
  const [a] = conferir('R$ 1.000,00 (mil reias)');
  assert.equal(a.status, 'ilegivel');
  assert.match(a.detalhe, /reias/);
  assert.equal(a.sugestao, 'mil reais');
});

test('modelos com campo em branco aparecem como ilegíveis', () => {
  const [a] = conferir('R$ 1.000,00 (valor por extenso)');
  assert.equal(a.status, 'ilegivel');
});

test('número fora do formato brasileiro', () => {
  const achados = conferir('R$ 1.25 (um real e vinte e cinco centavos) e R$ 1,234 (mil reais) e R$ 12.34.567,00 (x)');
  assert.deepEqual(achados.map((a) => a.status), ['formato', 'formato', 'formato']);
});

test('formatos de número aceitos', () => {
  assert.equal(lerNumero('1.234.567,89'), 123456789n);
  assert.equal(lerNumero('1234567'), 123456700n);
  assert.equal(lerNumero('0,5'), 50n);
  assert.equal(lerNumero('0,05'), 5n);
  assert.equal(lerNumero('1000000000000000'), null);
  assert.equal(lerNumero('1.2'), null);
  assert.equal(lerNumero(',50'), null);
});

test('texto sem o padrão não gera achados', () => {
  assert.deepEqual(conferir('Reunião às 10h (sala 3). Total: 100 reais (cem). R$ 50,00 sem extenso.'), []);
});

test('espaços e quebras entre R$ e o número, e valor sem unidade no extenso', () => {
  const achados = conferir('R$\u00a01.000,00 (mil) e R$   20,00 (vinte reais)');
  assert.deepEqual(achados.map((a) => [a.status, a.unidade]), [['ok', 'nenhuma'], ['ok', 'reais']]);
});

test('docx: texto, entidades e trechos de formatação partidos no meio do número', () => {
  const buf = docx(paragrafo('Valor: R$ 1.', '250,00 (mil duzentos e cinquenta reais)') + paragrafo('Cláusula &amp; multa R$ 3,00 (dois reais)'));
  const achados = conferir(textoDeDocx(buf));
  assert.deepEqual(achados.map((a) => [a.linha, a.status]), [[1, 'ok'], [2, 'diverge']]);
});

test('docx: texto apagado em controle de alterações não é conferido', () => {
  const apagado = '<w:p><w:del w:id="1" w:author="Ana"><w:r><w:delText>R$ 900,00 (nove reais)</w:delText></w:r></w:del><w:r><w:t>R$ 900,00 (novecentos reais)</w:t></w:r></w:p>';
  const achados = conferir(textoDeDocx(docx(apagado)));
  assert.equal(achados.length, 1);
  assert.equal(achados[0].status, 'ok');
  assert.equal(xmlWordParaTexto('<w:p><w:del w:id="2"/><w:r><w:t>fica</w:t></w:r></w:p>').trim(), 'fica');
});

test('docx: deslocamento de caixa de texto não vira número no texto', () => {
  const caixa = '<w:p><w:r><w:drawing><wp:anchor><wp:positionH><wp:posOffset>2136775</wp:posOffset></wp:positionH></wp:anchor></w:drawing></w:r><w:r><w:t>R$ 8,00 (oito reais)</w:t></w:r></w:p>';
  const texto = textoDeDocx(docx(caixa));
  assert.ok(!texto.includes('2136775'));
  assert.equal(conferir(texto)[0].status, 'ok');
});

test('docx: rodapé e notas entram, arquivo sem word/document.xml é recusado', () => {
  const rodape = `<w:ftr xmlns:w="x">${paragrafo('R$ 5,00 (quatro reais)')}</w:ftr>`;
  const achados = conferir(textoDeDocx(docx(paragrafo('oi'), [{ nome: 'word/footer1.xml', conteudo: rodape }])));
  assert.deepEqual(achados.map((a) => a.status), ['diverge']);
  assert.throws(() => textoDeDocx(montarZip([{ nome: 'a.txt', conteudo: 'x' }])), /não parece um \.docx/);
  assert.throws(() => textoDeDocx(Buffer.from('isto não é zip')), /zip/);
});

test('docx: entrada sem compressão', () => {
  const xml = `<w:document xmlns:w="x"><w:body>${paragrafo('R$ 7,00 (sete reais)')}</w:body></w:document>`;
  const buf = montarZip([{ nome: 'word/document.xml', conteudo: xml, metodo: 0 }]);
  assert.equal(conferir(textoDeDocx(buf))[0].status, 'ok');
});
