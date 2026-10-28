// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Endereco;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EnderecoRepository extends JpaRepository<Endereco, Integer> {

    List<Endereco> findByIdClienteId(Integer clienteId);

    Optional<Endereco> findByIdAndIdClienteId(Integer id, Integer clienteId);

    void deleteByIdCliente_Id(Integer clienteId);
}
