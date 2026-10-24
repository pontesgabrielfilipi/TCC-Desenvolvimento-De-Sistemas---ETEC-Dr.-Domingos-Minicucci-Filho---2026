import assert from 'node:assert/strict';
import test from 'node:test';
import { getBlobHttpErrorMessage } from '../../src/utils/httpError.ts';

function erroAxios(data: Blob | object) {
    return Object.assign(new Error('HTTP 400'), { isAxiosError: true, response: { data } });
}

test('decodifica message de erro JSON retornado pelo Axios como Blob', async () => {
    const erro = erroAxios(new Blob([JSON.stringify({ message: 'Data inicial posterior a data final.' })],
        { type: 'application/json' }));
    assert.equal(await getBlobHttpErrorMessage(erro, 'Falha genérica'), 'Data inicial posterior a data final.');
});

test('decodifica campo error de erro JSON em Blob', async () => {
    const erro = erroAxios(new Blob([JSON.stringify({ error: 'Relatório desconhecido' })]));
    assert.equal(await getBlobHttpErrorMessage(erro, 'Falha genérica'), 'Relatório desconhecido');
});

test('nao exibe HTML nem texto não JSON do proxy', async () => {
    const erro = erroAxios(new Blob(['<html>nginx 502</html>'], { type: 'text/html' }));
    assert.equal(await getBlobHttpErrorMessage(erro, 'Falha genérica'), 'Falha genérica');
});

test('preserva mensagens de falhas locais de validação da planilha', async () => {
    assert.equal(await getBlobHttpErrorMessage(new Error('Download interrompido'), 'Falha genérica'),
        'Download interrompido');
});
