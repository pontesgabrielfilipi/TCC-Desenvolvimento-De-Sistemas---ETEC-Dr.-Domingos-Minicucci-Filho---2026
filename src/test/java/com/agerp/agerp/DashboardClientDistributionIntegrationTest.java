package com.agerp.agerp;

import com.agerp.agerp.repository.ClienteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class DashboardClientDistributionIntegrationTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private ClienteRepository clientes;

    @BeforeEach
    void limparClientes() {
        jdbc.execute("TRUNCATE TABLE agerp.cliente RESTART IDENTITY CASCADE");
    }

    @Test
    void agrupaSomentePessoasFisicasMesmoComCodigosLegados() {
        inserir("PF", "FISICA", " fisica ");

        assertEquals(Map.of("Pessoa Física", 3L), distribuicao());
    }

    @Test
    void consolidaAmbasCategoriasSemDuplicarRotulosESeparaTipoDesconhecido() {
        inserir("PF", "FISICA", "PJ", "JURIDICA", "OUTRO", null);

        assertEquals(Map.of("Pessoa Física", 2L, "Pessoa Jurídica", 2L,
                "Não informado", 2L), distribuicao());
    }

    @Test
    void semClientesNaoProduzFatias() {
        assertTrue(clientes.distribuicaoTipoCliente().isEmpty());
    }

    private void inserir(String... tipos) {
        for (int i = 0; i < tipos.length; i++) {
            jdbc.update("INSERT INTO agerp.cliente (tipo, nome_razao) VALUES (?, ?)", tipos[i], "Cliente " + i);
        }
    }

    private Map<String, Long> distribuicao() {
        return clientes.distribuicaoTipoCliente().stream().collect(Collectors.toMap(
                linha -> (String) linha.get("name"),
                linha -> ((Number) linha.get("value")).longValue()));
    }
}
