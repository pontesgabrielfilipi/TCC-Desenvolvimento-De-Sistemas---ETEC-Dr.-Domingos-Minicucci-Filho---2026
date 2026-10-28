// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.service;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AuditoriaNegocioServiceTest {
    @Test
    void ignoraValoresIguaisECanonicalizaDecimais() {
        var mudancas = AuditoriaNegocioService.mudancas("preco", new BigDecimal("1.00"), new BigDecimal("1.0"),
                "custo", new BigDecimal("2.00"), new BigDecimal("3.50"));
        assertEquals(1, mudancas.size());
        assertEquals(Map.of("antes", "2", "depois", "3.5"), mudancas.get("custo"));
    }

    @Test
    void preservaTransicoesComNull() {
        var mudancas = AuditoriaNegocioService.mudancas("quantidadeAtual", null, 3);
        assertEquals(3, ((Map<?, ?>) mudancas.get("quantidadeAtual")).get("depois"));
        assertTrue(((Map<?, ?>) mudancas.get("quantidadeAtual")).containsKey("antes"));
    }
}
