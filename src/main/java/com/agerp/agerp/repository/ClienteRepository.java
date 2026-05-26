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
    Optional<Cliente> findByCpfCnpj(String cpfCnpj);
    @Query(value = """
    SELECT 
        CASE WHEN c.tipo = 'FISICA' THEN 'Pessoa Física' ELSE 'Pessoa Jurídica' END as name,
        COUNT(*) as value
    FROM agerp.cliente c
    GROUP BY c.tipo
    """, nativeQuery = true)
    List<Map<String, Object>> distribuicaoTipoCliente();
}