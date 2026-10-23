package com.agerp.agerp.service;

import com.agerp.agerp.entity.Estoque;
import com.agerp.agerp.entity.Produto;
import com.agerp.agerp.repository.EstoqueRepository;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EstoqueBaixoServiceTest {
    private final EstoqueRepository repository = mock(EstoqueRepository.class);
    private final ConfiguracaoSistemaService configuracoes = mock(ConfiguracaoSistemaService.class);
    private final EstoqueBaixoService service = new EstoqueBaixoService(repository, configuracoes);

    private static Estoque estoque(String nome, Integer atual, Integer minimoIndividual) {
        Produto produto = new Produto();
        produto.setNome(nome);
        Estoque estoque = new Estoque();
        estoque.setIdProduto(produto);
        estoque.setQuantidadeAtual(atual);
        estoque.setQuantidadeMinima(minimoIndividual);
        return estoque;
    }

    @Test
    void modoGeralComparaEstritamenteComLimiteConfiguradoEIgnoraLimitesIndividuais() {
        when(configuracoes.regraEstoque()).thenReturn(new EstoqueBaixoService.Regra(true, 15));
        when(repository.listarComProduto()).thenReturn(List.of(
                estoque("Abaixo", 14, 2), estoque("Igual", 15, 100),
                estoque("Acima", 16, 100), estoque("Sem minimo", 0, null)));

        var resultado = service.listar();
        assertEquals(List.of("Sem minimo", "Abaixo"), resultado.stream().map(EstoqueBaixoService.ProdutoBaixo::nome).toList());
        assertTrue(resultado.stream().allMatch(item -> item.minimo() == 15));
    }

    @Test
    void modoIndividualAceitaZeroETrataNuloHistoricoSemAlterarRegistro() {
        var abaixo = estoque("Abaixo", 4, 5);
        var igual = estoque("Igual", 5, 5);
        var acima = estoque("Acima", 6, 5);
        var zero = estoque("Minimo zero", 0, 0);
        var historico = estoque("Historico", 9, null);
        var semQuantidade = estoque("Sem quantidade", null, 20);
        when(configuracoes.regraEstoque()).thenReturn(new EstoqueBaixoService.Regra(false, 15));
        when(repository.listarComProduto()).thenReturn(List.of(abaixo, igual, acima, zero, historico, semQuantidade));

        var resultado = service.listar();
        assertEquals(List.of("Abaixo", "Historico"), resultado.stream().map(EstoqueBaixoService.ProdutoBaixo::nome).toList());
        assertEquals(5, resultado.getFirst().minimo());
        assertEquals(10, resultado.getLast().minimo());
        assertNull(historico.getQuantidadeMinima(), "Fallback de registro antigo nao deve sobrescrever o banco");
    }

    @Test
    void alternanciaPreservaMinimosIndividuaisEExportacaoRecebeListaCompleta() {
        var itens = new ArrayList<Estoque>();
        for (int indice = 0; indice < 12; indice++) {
            itens.add(estoque("Produto " + indice, 4, 5));
        }
        when(repository.listarComProduto()).thenReturn(itens);
        when(configuracoes.regraEstoque()).thenReturn(
                new EstoqueBaixoService.Regra(true, 4),
                new EstoqueBaixoService.Regra(false, 4),
                new EstoqueBaixoService.Regra(true, 6));

        assertTrue(service.listar().isEmpty(), "Igual ao limite geral nao e estoque baixo");
        assertEquals(12, service.listar().size(), "Nao limitar a lista usada pela exportacao a 10 itens");
        var resultadoGeral = service.listar();
        assertEquals(12, resultadoGeral.size());
        assertTrue(resultadoGeral.stream().allMatch(item -> item.minimo() == 6));
        assertTrue(itens.stream().allMatch(item -> item.getQuantidadeMinima() == 5));
        verify(repository, times(3)).listarComProduto();
    }
}
