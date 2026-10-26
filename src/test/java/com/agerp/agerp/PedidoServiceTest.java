package com.agerp.agerp;

import com.agerp.agerp.dto.ItemPedidoRequest;
import com.agerp.agerp.dto.PedidoCreateRequest;
import com.agerp.agerp.dto.PedidoResponse;
import com.agerp.agerp.dto.PedidoUpdateRequest;
import com.agerp.agerp.entity.*;
import com.agerp.agerp.repository.*;
import com.agerp.agerp.service.PedidoService;
import com.agerp.agerp.service.AuditoriaNegocioService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class PedidoServiceTest {

    @Mock
    private EnderecoRepository enderecoRepository;

    @Mock
    private PedidoRepository pedidoRepository;

    @Mock
    private ItemPedidoRepository itemPedidoRepository;

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private ProdutoRepository produtoRepository;

    @Mock
    private EstoqueRepository estoqueRepository;

    @Mock
    private MovimentacaoEstoqueRepository movimentacaoEstoqueRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private AuditoriaNegocioService auditoriaNegocioService;

    @InjectMocks
    private PedidoService pedidoService;

    private Cliente cliente;
    private Endereco endereco;
    private Produto produto1;
    private Produto produto2;
    private Estoque estoque1;
    private Estoque estoque2;

    @BeforeEach
    public void setup() {
        lenient().when(pedidoRepository.findByIdForUpdate(anyInt()))
                .thenAnswer(inv -> pedidoRepository.findById(inv.getArgument(0)));
        lenient().when(estoqueRepository.findByProdutoIdForUpdate(anyInt()))
                .thenAnswer(inv -> estoqueRepository.findByIdProduto_Id(inv.getArgument(0)));
        cliente = new Cliente();
        cliente.setId(1);
        cliente.setNomeRazao("Cliente Teste");
        cliente.setTipo("FISICA");
        cliente.setCpfCnpj("12345678900");

        endereco = new Endereco();
        endereco.setId(1);
        endereco.setIdCliente(cliente);
        endereco.setLogradouro("Rua de Teste");
        endereco.setNumero("123");
        endereco.setBairro("Centro");
        endereco.setCidade("Botucatu");
        endereco.setEstado("SP");
        endereco.setCep("18600-000");

        produto1 = new Produto();
        produto1.setId(10);
        produto1.setNome("Notebook");
        produto1.setPreco(BigDecimal.valueOf(100.00));
        produto1.setAtivo(true);

        produto2 = new Produto();
        produto2.setId(20);
        produto2.setNome("Mouse");
        produto2.setPreco(BigDecimal.valueOf(50.00));
        produto2.setAtivo(true);

        estoque1 = new Estoque();
        estoque1.setId(100);
        estoque1.setIdProduto(produto1);
        estoque1.setQuantidadeAtual(10);

        estoque2 = new Estoque();
        estoque2.setId(200);
        estoque2.setIdProduto(produto2);
        estoque2.setQuantidadeAtual(5);
    }

    // ====================== TESTES DE CRIAÇÃO ======================

    @Test
    @DisplayName("Deve criar pedido com sucesso e calcular valor total correto")
    public void testCriarPedidoComSucesso() {
        when(clienteRepository.findById(1))
                .thenReturn(Optional.of(cliente));

        when(enderecoRepository.findByIdAndIdClienteId(1, 1))
                .thenReturn(Optional.of(endereco));

        when(produtoRepository.findById(10))
                .thenReturn(Optional.of(produto1));

        when(produtoRepository.findById(20))
                .thenReturn(Optional.of(produto2));

        when(estoqueRepository.findByIdProduto_Id(10))
                .thenReturn(Optional.of(estoque1));

        when(estoqueRepository.findByIdProduto_Id(20))
                .thenReturn(Optional.of(estoque2));

        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(invocation -> {
            Pedido pedido = invocation.getArgument(0);
            pedido.setId(1);
            return pedido;
        });

        PedidoCreateRequest request = new PedidoCreateRequest(
                1,
                1,
                List.of(
                        new ItemPedidoRequest(10, 2),
                        new ItemPedidoRequest(20, 1)
                ),
                "Observação do teste"
        );

        PedidoResponse response = pedidoService.criar(request);

        assertNotNull(response);
        assertEquals(1, response.getId());
        assertEquals("PENDENTE", response.getStatus());
        assertEquals(BigDecimal.valueOf(250.00), response.getValorTotal());
        assertEquals(2, response.getItens().size());

        verify(pedidoRepository, times(1)).save(any(Pedido.class));
        verify(itemPedidoRepository, times(2)).save(any(ItemPedido.class));
    }

    @Test
    @DisplayName("Deve falhar ao criar pedido com cliente inexistente")
    public void testCriarPedidoComClienteInexistente() {
        when(clienteRepository.findById(999))
                .thenReturn(Optional.empty());

        PedidoCreateRequest request = new PedidoCreateRequest(
                999,
                1,
                List.of(new ItemPedidoRequest(10, 1)),
                null
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.criar(request)
        );

        assertTrue(ex.getMessage().contains("Cliente não encontrado"));
    }

    @Test
    @DisplayName("Deve falhar ao criar pedido sem itens")
    public void testCriarPedidoSemItens() {
        when(clienteRepository.findById(1))
                .thenReturn(Optional.of(cliente));

        PedidoCreateRequest request = new PedidoCreateRequest(
                1,
                1,
                List.of(),
                null
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.criar(request)
        );

        assertTrue(ex.getMessage().contains("pelo menos um item"));
    }

    @Test
    @DisplayName("Deve falhar ao criar pedido com produto inexistente")
    public void testCriarPedidoComProdutoInexistente() {
        when(clienteRepository.findById(1))
                .thenReturn(Optional.of(cliente));

        when(enderecoRepository.findByIdAndIdClienteId(1, 1))
                .thenReturn(Optional.of(endereco));

        when(produtoRepository.findById(999))
                .thenReturn(Optional.empty());

        PedidoCreateRequest request = new PedidoCreateRequest(
                1,
                1,
                List.of(new ItemPedidoRequest(999, 1)),
                null
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.criar(request)
        );

        assertTrue(ex.getMessage().contains("Produto não encontrado"));
    }

    @Test
    @DisplayName("Deve falhar ao criar pedido com produto inativo")
    public void testCriarPedidoComProdutoInativo() {
        produto1.setAtivo(false);

        when(clienteRepository.findById(1))
                .thenReturn(Optional.of(cliente));

        when(enderecoRepository.findByIdAndIdClienteId(1, 1))
                .thenReturn(Optional.of(endereco));

        when(produtoRepository.findById(10))
                .thenReturn(Optional.of(produto1));

        PedidoCreateRequest request = new PedidoCreateRequest(
                1,
                1,
                List.of(new ItemPedidoRequest(10, 1)),
                null
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.criar(request)
        );

        assertTrue(ex.getMessage().contains("inativo"));
    }

    @Test
    @DisplayName("Deve falhar ao criar pedido com produto duplicado")
    public void testCriarPedidoComProdutoDuplicado() {
        when(clienteRepository.findById(1))
                .thenReturn(Optional.of(cliente));

        when(enderecoRepository.findByIdAndIdClienteId(1, 1))
                .thenReturn(Optional.of(endereco));

        when(produtoRepository.findById(10))
                .thenReturn(Optional.of(produto1));

        when(estoqueRepository.findByIdProduto_Id(10))
                .thenReturn(Optional.of(estoque1));

        PedidoCreateRequest request = new PedidoCreateRequest(
                1,
                1,
                List.of(
                        new ItemPedidoRequest(10, 1),
                        new ItemPedidoRequest(10, 2)
                ),
                null
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.criar(request)
        );

        assertTrue(ex.getMessage().contains("duplicado"));
    }

    @Test
    @DisplayName("Deve falhar ao criar pedido quando o estoque for insuficiente")
    public void testCriarPedidoComEstoqueInsuficiente() {
        when(clienteRepository.findById(1))
                .thenReturn(Optional.of(cliente));

        when(enderecoRepository.findByIdAndIdClienteId(1, 1))
                .thenReturn(Optional.of(endereco));

        when(produtoRepository.findById(10))
                .thenReturn(Optional.of(produto1));

        when(estoqueRepository.findByIdProduto_Id(10))
                .thenReturn(Optional.of(estoque1));

        PedidoCreateRequest request = new PedidoCreateRequest(
                1,
                1,
                List.of(new ItemPedidoRequest(10, 25)),
                null
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.criar(request)
        );

        assertTrue(ex.getMessage().contains("Estoque insuficiente"));
    }

    // ====================== TESTES DE MUDANÇA DE STATUS ======================

    @Test
    @DisplayName("Deve realizar transição válida para CONFIRMADO com baixa de estoque")
    public void testTransicaoValidaComBaixaDeEstoque() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("PENDENTE");
        pedido.setIdCliente(cliente);

        ItemPedido item = new ItemPedido();
        item.setId(1);
        item.setIdPedido(pedido);
        item.setIdProduto(produto1);
        item.setQuantidade(3);
        item.setPrecoUnitario(produto1.getPreco());
        pedido.getItens().add(item);

        when(pedidoRepository.findById(1))
                .thenReturn(Optional.of(pedido));

        when(estoqueRepository.findByIdProduto_Id(10))
                .thenReturn(Optional.of(estoque1));

        when(pedidoRepository.save(any(Pedido.class)))
                .thenReturn(pedido);

        PedidoResponse response = pedidoService.mudarStatus(1, "CONFIRMADO");

        assertEquals("CONFIRMADO", response.getStatus());
        assertEquals(7, estoque1.getQuantidadeAtual());

        verify(estoqueRepository, times(1)).save(estoque1);
        verify(movimentacaoEstoqueRepository, times(1)).save(argThat(mov ->
                "SAIDA".equals(mov.getTipo())
                        && mov.getQuantidade() == 3
        ));
    }

    @Test
    @DisplayName("Deve falhar na transição com status desconhecido")
    public void testStatusDesconhecido() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("PENDENTE");

        when(pedidoRepository.findById(1))
                .thenReturn(Optional.of(pedido));

        assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.mudarStatus(1, "STATUS_INEXISTENTE")
        );
    }

    @Test
    @DisplayName("Deve falhar na transição inválida de PENDENTE para ENTREGUE")
    public void testTransicaoInvalida() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("PENDENTE");

        when(pedidoRepository.findById(1))
                .thenReturn(Optional.of(pedido));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.mudarStatus(1, "ENTREGUE")
        );

        assertTrue(ex.getMessage().contains("Transição inválida"));
    }

    @Test
    @DisplayName("Operação deve ser idempotente quando transitar para o mesmo status")
    public void testTransicaoIdempotenteMesmoStatus() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("CONFIRMADO");
        pedido.setIdCliente(cliente);

        when(pedidoRepository.findById(1))
                .thenReturn(Optional.of(pedido));

        PedidoResponse response = pedidoService.mudarStatus(1, "CONFIRMADO");

        assertEquals("CONFIRMADO", response.getStatus());
        verify(estoqueRepository, never()).save(any());
        verify(movimentacaoEstoqueRepository, never()).save(any());
    }

    // ====================== TESTES DE CANCELAMENTO ======================

    @Test
    @DisplayName("Deve cancelar pedido PENDENTE sem estorno de estoque")
    public void testCancelarPedidoPendenteSemEstorno() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("PENDENTE");
        pedido.setIdCliente(cliente);

        ItemPedido item = new ItemPedido();
        item.setId(1);
        item.setIdPedido(pedido);
        item.setIdProduto(produto1);
        item.setQuantidade(3);
        item.setPrecoUnitario(produto1.getPreco());
        pedido.getItens().add(item);

        when(pedidoRepository.findById(1))
                .thenReturn(Optional.of(pedido));

        when(pedidoRepository.save(any(Pedido.class)))
                .thenReturn(pedido);

        PedidoResponse response = pedidoService.cancelar(1);

        assertEquals("CANCELADO", response.getStatus());
        verify(estoqueRepository, never()).save(any());
        verify(movimentacaoEstoqueRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve cancelar pedido CONFIRMADO e estornar estoque")
    public void testCancelarPedidoConfirmadoComEstorno() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("CONFIRMADO");
        pedido.setIdCliente(cliente);

        ItemPedido item = new ItemPedido();
        item.setId(1);
        item.setIdPedido(pedido);
        item.setIdProduto(produto1);
        item.setQuantidade(4);
        item.setPrecoUnitario(produto1.getPreco());
        pedido.getItens().add(item);

        estoque1.setQuantidadeAtual(6);

        when(pedidoRepository.findById(1))
                .thenReturn(Optional.of(pedido));

        when(estoqueRepository.findByIdProduto_Id(10))
                .thenReturn(Optional.of(estoque1));

        when(pedidoRepository.save(any(Pedido.class)))
                .thenReturn(pedido);

        PedidoResponse response = pedidoService.cancelar(1);

        assertEquals("CANCELADO", response.getStatus());
        assertEquals(10, estoque1.getQuantidadeAtual());

        verify(estoqueRepository, times(1)).save(estoque1);
        verify(movimentacaoEstoqueRepository, times(1)).save(argThat(mov ->
                "ENTRADA".equals(mov.getTipo())
                        && mov.getQuantidade() == 4
        ));
    }

    @Test
    @DisplayName("Não deve permitir cancelar pedido ENTREGUE")
    public void testNaoPermitirCancelarPedidoEntregue() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("ENTREGUE");

        when(pedidoRepository.findById(1))
                .thenReturn(Optional.of(pedido));

        assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.cancelar(1)
        );
    }

    // ====================== TESTES DE ATUALIZAÇÃO ======================

    @Test
    @DisplayName("Deve atualizar pedido PENDENTE com sucesso")
    public void testAtualizarPedidoPendente() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("PENDENTE");
        pedido.setIdCliente(cliente);

        when(pedidoRepository.findById(1))
                .thenReturn(Optional.of(pedido));

        when(clienteRepository.findById(1))
                .thenReturn(Optional.of(cliente));

        when(enderecoRepository.findByIdAndIdClienteId(1, 1))
                .thenReturn(Optional.of(endereco));

        when(produtoRepository.findById(20))
                .thenReturn(Optional.of(produto2));

        when(estoqueRepository.findByIdProduto_Id(20))
                .thenReturn(Optional.of(estoque2));

        when(pedidoRepository.save(any(Pedido.class)))
                .thenReturn(pedido);

        PedidoUpdateRequest updateRequest = new PedidoUpdateRequest(
                1,
                1,
                List.of(new ItemPedidoRequest(20, 2)),
                "Obs alterada"
        );

        PedidoResponse response = pedidoService.atualizar(1, updateRequest);

        assertNotNull(response);
        assertEquals(BigDecimal.valueOf(100.00), pedido.getValorTotal());

        verify(itemPedidoRepository, times(1)).deleteAll(any());
        verify(itemPedidoRepository, times(1)).save(any(ItemPedido.class));
    }

    @Test
    @DisplayName("Deve falhar ao atualizar pedido que não está PENDENTE")
    public void testAtualizarPedidoNaoPendenteFalha() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("CONFIRMADO");

        when(pedidoRepository.findById(1))
                .thenReturn(Optional.of(pedido));

        PedidoUpdateRequest updateRequest = new PedidoUpdateRequest(
                1,
                1,
                List.of(new ItemPedidoRequest(10, 1)),
                null
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.atualizar(1, updateRequest)
        );

        assertTrue(ex.getMessage().contains(
                "Apenas pedidos PENDENTES podem ser editados"
        ));
    }

    // ====================== TESTES DE CONSULTA ======================

    @Test
    @DisplayName("Deve listar todos os pedidos")
    public void testListarTodos() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("PENDENTE");
        pedido.setIdCliente(cliente);
        pedido.setValorTotal(BigDecimal.TEN);

        when(pedidoRepository.findAllByOrderByDataPedidoDesc())
                .thenReturn(List.of(pedido));

        List<PedidoResponse> lista = pedidoService.listarTodos();

        assertEquals(1, lista.size());
        assertEquals(1, lista.get(0).getId());
    }

    @Test
    @DisplayName("Deve buscar pedido por ID")
    public void testBuscarPorId() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("PENDENTE");
        pedido.setIdCliente(cliente);
        pedido.setValorTotal(BigDecimal.TEN);

        when(pedidoRepository.findById(1))
                .thenReturn(Optional.of(pedido));

        PedidoResponse response = pedidoService.buscarPorId(1);

        assertEquals(1, response.getId());
    }

    @Test
    @DisplayName("Deve falhar ao buscar pedido inexistente por ID")
    public void testBuscarPorIdInexistente() {
        when(pedidoRepository.findById(99))
                .thenReturn(Optional.empty());

        assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.buscarPorId(99)
        );
    }

    // ====================== TESTES DE ENDEREÇO DE ENTREGA ======================

    @Test
    @DisplayName("Deve falhar ao criar pedido com endereço que não pertence ao cliente")
    public void testCriarPedidoComEnderecoNaoPertencenteAoCliente() {
        when(clienteRepository.findById(1))
                .thenReturn(Optional.of(cliente));

        when(enderecoRepository.findByIdAndIdClienteId(99, 1))
                .thenReturn(Optional.empty());

        PedidoCreateRequest request = new PedidoCreateRequest(
                1,
                99,
                List.of(new ItemPedidoRequest(10, 1)),
                "Observação"
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.criar(request)
        );

        assertTrue(ex.getMessage().contains("não pertence ao cliente informado"));
    }

    @Test
    @DisplayName("Deve criar pedido com sucesso sem endereço de entrega (opcional)")
    public void testCriarPedidoSemEnderecoComSucesso() {
        when(clienteRepository.findById(1))
                .thenReturn(Optional.of(cliente));

        when(produtoRepository.findById(10))
                .thenReturn(Optional.of(produto1));

        when(estoqueRepository.findByIdProduto_Id(10))
                .thenReturn(Optional.of(estoque1));

        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(invocation -> {
            Pedido p = invocation.getArgument(0);
            p.setId(1);
            return p;
        });

        PedidoCreateRequest request = new PedidoCreateRequest(
                1,
                null,
                List.of(new ItemPedidoRequest(10, 1)),
                "Sem endereço"
        );

        PedidoResponse response = pedidoService.criar(request);

        assertNotNull(response);
        assertNull(response.getIdEndereco());
        assertNull(response.getEnderecoResumo());
        verify(enderecoRepository, never()).findByIdAndIdClienteId(anyInt(), anyInt());
    }

    @Test
    @DisplayName("Deve falhar ao atualizar pedido com endereço que não pertence ao cliente")
    public void testAtualizarPedidoComEnderecoNaoPertencenteAoCliente() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("PENDENTE");
        pedido.setIdCliente(cliente);

        when(pedidoRepository.findById(1))
                .thenReturn(Optional.of(pedido));

        when(clienteRepository.findById(1))
                .thenReturn(Optional.of(cliente));

        when(enderecoRepository.findByIdAndIdClienteId(99, 1))
                .thenReturn(Optional.empty());

        PedidoUpdateRequest updateRequest = new PedidoUpdateRequest(
                1,
                99,
                List.of(new ItemPedidoRequest(10, 1)),
                "Obs"
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> pedidoService.atualizar(1, updateRequest)
        );

        assertTrue(ex.getMessage().contains("não pertence ao cliente informado"));
    }

    @Test
    @DisplayName("Exclusão lógica deve rejeitar pedido entregue")
    void testExcluirPedidoEntregue() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("ENTREGUE");
        when(pedidoRepository.findById(1)).thenReturn(Optional.of(pedido));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> pedidoService.deletarSoft(1));

        assertTrue(ex.getMessage().contains("entregue"));
        verify(pedidoRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Exclusão lógica repetida de pedido cancelado deve ser idempotente")
    void testExcluirPedidoCanceladoNovamente() {
        Pedido pedido = new Pedido();
        pedido.setId(1);
        pedido.setStatus("CANCELADO");
        when(pedidoRepository.findById(1)).thenReturn(Optional.of(pedido));

        assertDoesNotThrow(() -> pedidoService.deletarSoft(1));
        verify(pedidoRepository, never()).save(any());
    }
}
