package com.agerp.agerp.service;

import com.agerp.agerp.entity.Estoque;
import com.agerp.agerp.entity.Produto;
import com.agerp.agerp.repository.EstoqueRepository;
import com.agerp.agerp.repository.ProdutoRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProdutoServiceEstoqueListaTest {

    private static Produto produto(int id, String nome) {
        var produto = new Produto();
        produto.setId(id);
        produto.setNome(nome);
        produto.setPreco(new BigDecimal("29.90"));
        produto.setAtivo(true);
        return produto;
    }

    private static Estoque estoque(Produto produto, Integer quantidade) {
        var estoque = new Estoque();
        estoque.setIdProduto(produto);
        estoque.setQuantidadeAtual(quantidade);
        estoque.setQuantidadeMinima(10);
        return estoque;
    }

    @Test
    void listaProdutosComSaldosEmLoteEPreservaZeroNuloEAusente() {
        var produtos = mock(ProdutoRepository.class);
        var estoques = mock(EstoqueRepository.class);
        var estoqueBaixo = mock(EstoqueBaixoService.class);
        var service = new ProdutoService(produtos, estoques, estoqueBaixo);
        var positivo = produto(1, "Produto de nome muito longo para validar a exibição");
        var zerado = produto(2, "Produto zerado");
        var semRegistro = produto(3, "Produto sem estoque cadastrado");
        var semQuantidade = produto(4, "Produto com saldo nulo");

        when(estoqueBaixo.regraAtual()).thenReturn(new EstoqueBaixoService.Regra(true, 15));
        when(produtos.findByAtivoTrue()).thenReturn(List.of(positivo, zerado, semRegistro, semQuantidade));
        when(estoques.buscarPorProdutos(List.of(1, 2, 3, 4))).thenReturn(List.of(
                estoque(positivo, 12), estoque(zerado, 0), estoque(semQuantidade, null)));

        var resposta = service.listarAtivos();

        assertEquals(4, resposta.size());
        assertEquals(12, resposta.get(0).getQuantidadeAtual());
        assertEquals(0, resposta.get(1).getQuantidadeAtual());
        assertNull(resposta.get(2).getQuantidadeAtual(), "Ausência de registro não é estoque zero");
        assertNull(resposta.get(3).getQuantidadeAtual(), "Saldo nulo não é estoque zero");
        assertEquals(positivo.getNome(), resposta.get(0).getNome());
        assertEquals(positivo.getPreco(), resposta.get(0).getPreco());
        verify(estoques, times(1)).buscarPorProdutos(List.of(1, 2, 3, 4));
        verify(estoques, never()).findByIdProdutoId(anyInt());
    }
}
