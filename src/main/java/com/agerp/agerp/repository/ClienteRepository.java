package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Cliente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public interface ClienteRepository extends JpaRepository<Cliente, Integer> {

    boolean existsByCpfCnpj(String cpfCnpj);
    boolean existsByEmail(String email);
    boolean existsByCpfCnpjAndIdNot(String cpfCnpj, Integer id);
    boolean existsByEmailIgnoreCaseAndIdNot(String email, Integer id);
    Optional<Cliente> findByCpfCnpj(String cpfCnpj);
    @Query(value = """
    SELECT classificacao.name AS name, COUNT(*) AS value
    FROM (
        SELECT CASE
            WHEN UPPER(TRIM(c.tipo)) IN ('FISICA', 'PF') THEN 'Pessoa Física'
            WHEN UPPER(TRIM(c.tipo)) IN ('JURIDICA', 'PJ') THEN 'Pessoa Jurídica'
            ELSE 'Não informado'
        END AS name
        FROM agerp.cliente c
    ) classificacao
    GROUP BY classificacao.name
    """, nativeQuery = true)
    List<Map<String, Object>> distribuicaoTipoCliente();
}
