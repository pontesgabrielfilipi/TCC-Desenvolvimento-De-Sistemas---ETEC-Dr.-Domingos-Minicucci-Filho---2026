// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.service;

import com.agerp.agerp.repository.EstoqueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

/** Centraliza a regra usada por produtos, dashboards e exportações. */
@Service
public class EstoqueBaixoService {
    /** Registros antigos sem mínimo usam 10 sem alterar o cadastro persistido. */
    public static final int MINIMO_INDIVIDUAL_PADRAO = 10;

    public record Regra(boolean usarGeral, int limiteGeral) {
        public int minimoAplicado(Integer minimoIndividual) {
            return usarGeral ? limiteGeral
                    : minimoIndividual == null ? MINIMO_INDIVIDUAL_PADRAO : minimoIndividual;
        }

        public boolean baixo(Integer atual, Integer individual) {
            return atual != null && atual < minimoAplicado(individual);
        }
    }

    public record ProdutoBaixo(String nome, int quantidade, int minimo) {}

    private final EstoqueRepository estoques;
    private final ConfiguracaoSistemaService configuracoes;

    public EstoqueBaixoService(EstoqueRepository estoques, ConfiguracaoSistemaService configuracoes) {
        this.estoques = estoques;
        this.configuracoes = configuracoes;
    }

    public Regra regraAtual() {
        return configuracoes.regraEstoque();
    }

    @Transactional(readOnly = true)
    public List<ProdutoBaixo> listar() {
        Regra regra = regraAtual();
        return estoques.listarComProduto().stream()
                .filter(estoque -> regra.baixo(estoque.getQuantidadeAtual(), estoque.getQuantidadeMinima()))
                .map(estoque -> new ProdutoBaixo(estoque.getIdProduto().getNome(),
                        estoque.getQuantidadeAtual(), regra.minimoAplicado(estoque.getQuantidadeMinima())))
                .sorted(Comparator.comparingInt(ProdutoBaixo::quantidade).thenComparing(ProdutoBaixo::nome))
                .toList();
    }
}
