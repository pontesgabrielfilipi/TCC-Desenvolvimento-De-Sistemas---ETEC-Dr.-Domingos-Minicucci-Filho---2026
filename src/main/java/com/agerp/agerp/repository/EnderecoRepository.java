package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Cliente;
import com.agerp.agerp.entity.Endereco;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EnderecoRepository extends JpaRepository<Endereco, Integer> {

    List<Endereco> findByIdClienteId(Integer clienteId);

    void deleteByIdCliente(Optional<Cliente> idCliente);
}