import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valorPorExtenso, lerExtenso, formatarMoeda, inteiroPorExtenso, LIMITE_REAIS } from '../src/extenso.mjs';
import { lcg } from './ajudantes.mjs';

const r = (reais, centavos = 0) => BigInt(reais) * 100n + BigInt(centavos);

test('escrita por extenso de valores fixos', () => {
  const casos = [
    [0n, 'zero reais'],
    [1n, 'um centavo'],
    [50n, 'cinquenta centavos'],
    [r(1), 'um real'],
    [r(1, 1), 'um real e um centavo'],
    [r(2, 2), 'dois reais e dois centavos'],
    [r(11), 'onze reais'],
    [r(21), 'vinte e um reais'],
    [r(100), 'cem reais'],
    [r(101), 'cento e um reais'],
    [r(110), 'cento e dez reais'],
    [r(999), 'novecentos e noventa e nove reais'],
    [r(1000), 'mil reais'],
    [r(1001), 'mil e um reais'],
    [r(1100), 'mil e cem reais'],
    [r(1250), 'mil duzentos e cinquenta reais'],
    [r(2000), 'dois mil reais'],
    [r(21000), 'vinte e um mil reais'],
    [r(100000), 'cem mil reais'],
    [r(101000), 'cento e um mil reais'],
    [r(1000000), 'um milhão de reais'],
    [r(2000000), 'dois milhões de reais'],
    [r(1000001), 'um milhão e um reais'],
    [r(1500000), 'um milhão e quinhentos mil reais'],
    [r(1250000), 'um milhão duzentos e cinquenta mil reais'],
    [r(2002005), 'dois milhões dois mil e cinco reais'],
    [r(1000000000), 'um bilhão de reais'],
    [r(3000000000000), 'três trilhões de reais'],
    [r(1000000, 1), 'um milhão de reais e um centavo'],
    [r(1234, 56), 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos'],
  ];
  for (const [valor, esperado] of casos) assert.equal(valorPorExtenso(valor), esperado, `${valor}`);
});

test('leitura de variações reais de escrita', () => {
  const casos = [
    ['um mil reais', r(1000)],
    ['hum real', r(1)],
    ['CEM REAIS', r(100)],
    ['Mil e quinhentos reais', r(1500)],
    ['mil, duzentos e cinquenta reais', r(1250)],
    ['quatorze reais', r(14)],
    ['catorze reais', r(14)],
    ['dezasseis reais', r(16)],
    ['dez e seis reais', r(16)],
    ['duas mil reais', r(2000)],
    ['milhão de reais', r(1000000)],
    ['um milhão e duzentos mil reais', r(1200000)],
    ['trezentos e trinta e três reais e trinta e três centavos', r(333, 33)],
    ['três reais', r(3)],
    ['zero reais', 0n],
    ['cinquenta centavos', 50n],
    ['  mil\n reais ', r(1000)],
    ['vinte e cinco', r(25)],
    ['trezentos milhões e vinte e seis mil setecentos e sessenta e sete reais e cinquenta e quatro centavos', r(300026767, 54)],
    ['quarenta e nove bilhões cento e noventa e um milhões e cinquenta e dois mil trezentos e trinta e seis reais', r(49191052336)],
  ];
  for (const [texto, esperado] of casos) {
    const lido = lerExtenso(texto);
    assert.equal(lido.erro, undefined, `${texto}: ${lido.erro}`);
    assert.equal(lido.centavos, esperado, texto);
  }
});

test('unidade monetária identificada', () => {
  assert.equal(lerExtenso('mil reais').unidade, 'reais');
  assert.equal(lerExtenso('cinquenta centavos').unidade, 'centavos');
  assert.equal(lerExtenso('um real e um centavo').unidade, 'ambas');
  assert.equal(lerExtenso('mil').unidade, 'nenhuma');
});

test('texto que não dá para ler é recusado com motivo', () => {
  const casos = [
    'mil reias',
    'vinte e trinta reais',
    'cem reais e cinquenta',
    'um milhão mil milhões de reais',
    'reais',
    '',
    'mil reais e cem centavos',
    'um vinte reais',
    'cento e onze e cinco reais',
    'centavos',
    'valor por extenso',
  ];
  for (const texto of casos) assert.ok(lerExtenso(texto).erro, `deveria recusar: "${texto}"`);
});

test('ida e volta em todos os valores de R$ 0,00 a R$ 300,00 e de 0 a 20 mil reais redondos', () => {
  for (let c = 0n; c <= 30000n; c++) assert.equal(lerExtenso(valorPorExtenso(c)).centavos, c, `${c}`);
  for (let reais = 0n; reais <= 20000n; reais++) {
    const c = reais * 100n + (reais % 100n);
    assert.equal(lerExtenso(valorPorExtenso(c)).centavos, c, `${c}`);
  }
});

test('ida e volta em amostra pseudoaleatória até 999 trilhões', () => {
  const prox = lcg(20261125);
  for (let i = 0; i < 20000; i++) {
    const bits = Number(prox() % 50n) + 1;
    const c = (prox() * prox()) % (1n << BigInt(bits));
    const limitado = c % (LIMITE_REAIS * 100n);
    assert.equal(lerExtenso(valorPorExtenso(limitado)).centavos, limitado, `${limitado}`);
  }
});

test('limites', () => {
  assert.throws(() => valorPorExtenso(LIMITE_REAIS * 100n), RangeError);
  assert.throws(() => valorPorExtenso(-1n), RangeError);
  assert.throws(() => inteiroPorExtenso(5), RangeError);
  assert.equal(lerExtenso(valorPorExtenso(LIMITE_REAIS * 100n - 1n)).centavos, LIMITE_REAIS * 100n - 1n);
});

test('formatação de moeda', () => {
  assert.equal(formatarMoeda(0n), 'R$ 0,00');
  assert.equal(formatarMoeda(5n), 'R$ 0,05');
  assert.equal(formatarMoeda(r(1234567, 8)), 'R$ 1.234.567,08');
});
