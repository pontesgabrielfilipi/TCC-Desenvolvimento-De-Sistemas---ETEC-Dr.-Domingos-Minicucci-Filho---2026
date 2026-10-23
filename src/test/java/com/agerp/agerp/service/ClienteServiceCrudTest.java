package com.agerp.agerp.service;

import com.agerp.agerp.config.BusinessConflictException;
import com.agerp.agerp.dto.ClienteCreateRequest;
import com.agerp.agerp.entity.Cliente;
import com.agerp.agerp.repository.ClienteRepository;
import com.agerp.agerp.repository.EnderecoRepository;
import com.agerp.agerp.repository.PedidoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class ClienteServiceCrudTest {
    private ClienteRepository clientes;
    private EnderecoRepository enderecos;
    private PedidoRepository pedidos;
    private ClienteService service;

    @BeforeEach
    void setUp() {
        clientes = mock(ClienteRepository.class);
        enderecos = mock(EnderecoRepository.class);
        pedidos = mock(PedidoRepository.class);
        service = new ClienteService(clientes, enderecos, pedidos);
        when(clientes.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void atualizaClientePreservandoIdentidade() {
        Cliente cliente = cliente(7, "Cliente Antigo", "111.111.111-11", "antigo@agerp.com");
        when(clientes.findById(7)).thenReturn(Optional.of(cliente));

        var response = service.atualizar(7,
                request("  Cliente Atualizado  ", "222.222.222-22", "novo@agerp.com"));

        assertEquals(7, response.getId());
        assertEquals("Cliente Atualizado", response.getNomeRazao());
        assertEquals("novo@agerp.com", response.getEmail());
        verify(clientes).save(cliente);
    }

    @Test
    void rejeitaDocumentoDuplicadoNaEdicao() {
        when(clientes.findById(7)).thenReturn(Optional.of(cliente(7, "Cliente", "111", "a@agerp.com")));
        when(clientes.existsByCpfCnpjAndIdNot("222", 7)).thenReturn(true);

        assertThrows(BusinessConflictException.class,
                () -> service.atualizar(7, request("Cliente", "222", "a@agerp.com")));
        verify(clientes, never()).save(any());
    }

    @Test
    void bloqueiaExclusaoQuandoHaPedidos() {
        when(clientes.existsById(7)).thenReturn(true);
        when(pedidos.existsByIdCliente_Id(7)).thenReturn(true);

        assertThrows(BusinessConflictException.class, () -> service.deletar(7));
        verifyNoInteractions(enderecos);
        verify(clientes, never()).deleteById(anyInt());
    }

    @Test
    void excluiClienteSemHistoricoESeusEnderecos() {
        when(clientes.existsById(7)).thenReturn(true);

        service.deletar(7);

        verify(enderecos).deleteByIdCliente_Id(7);
        verify(clientes).deleteById(7);
    }

    private static ClienteCreateRequest request(String nome, String documento, String email) {
        ClienteCreateRequest request = new ClienteCreateRequest();
        request.setTipo("FISICA");
        request.setNomeRazao(nome);
        request.setCpfCnpj(documento);
        request.setEmail(email);
        request.setTelefone("(14) 99999-9999");
        return request;
    }

    private static Cliente cliente(int id, String nome, String documento, String email) {
        Cliente cliente = new Cliente();
        cliente.setId(id);
        cliente.setTipo("FISICA");
        cliente.setNomeRazao(nome);
        cliente.setCpfCnpj(documento);
        cliente.setEmail(email);
        return cliente;
    }
}
