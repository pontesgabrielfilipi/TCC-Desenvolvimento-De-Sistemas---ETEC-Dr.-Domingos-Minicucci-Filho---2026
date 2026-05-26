package com.agerp.agerp.config;

import com.agerp.agerp.entity.*;
import com.agerp.agerp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Random;

@Component
@RequiredArgsConstructor
public class DatabaseSeeder implements CommandLineRunner {

    private final PerfilRepository perfilRepository;
    private final UsuarioRepository usuarioRepository;
    private final ClienteRepository clienteRepository;
    private final EnderecoRepository enderecoRepository;
    private final ProdutoRepository produtoRepository;
    private final EstoqueRepository estoqueRepository;
    private final PedidoRepository pedidoRepository;
    private final ItemPedidoRepository itemPedidoRepository;
    private final PagamentoRepository pagamentoRepository;
    private final EntregaRepository entregaRepository;

    private final PasswordEncoder passwordEncoder;

    private final Random random = new Random();

    @Override
    public void run(String... args) throws Exception {

        System.out.println("🚀 Iniciando Database Seeder COMPLETO...");

        // 1. Perfis
        if (perfilRepository.count() == 0) {
            criarPerfisIniciais();
        } else {
            System.out.println("✅ Perfis já existem.");
        }

        // 2. Usuários (12)
        if (usuarioRepository.count() == 0) {
            criarUsuariosIniciais();
        } else {
            System.out.println("✅ Usuários já existem.");
        }

        // 3. Clientes (10)
        if (clienteRepository.count() == 0) {
            criarClientesIniciais();
        } else {
            System.out.println("✅ Clientes já existem.");
        }

        // 4. Endereços (10)
        if (enderecoRepository.count() == 0) {
            criarEnderecosIniciais();
        } else {
            System.out.println("✅ Endereços já existem.");
        }

        // 5. Produtos + Estoque (15)
        if (produtoRepository.count() == 0) {
            criarProdutosEEstoquesIniciais();
        } else {
            System.out.println("✅ Produtos e estoques já existem.");
        }

        // 6. Pedidos completos (12)
        if (pedidoRepository.count() == 0) {
            criarPedidosCompletosIniciais();
        } else {
            System.out.println("✅ Pedidos já existem.");
        }

        System.out.println("🎉 Database Seeder finalizado com sucesso! ✅");
        System.out.println("   • 4 Perfis");
        System.out.println("   • 12 Usuários");
        System.out.println("   • 10 Clientes + 10 Endereços");
        System.out.println("   • 15 Produtos + Estoque");
        System.out.println("   • 12 Pedidos completos");
    }

    // ====================== PERFIS ======================
    private void criarPerfisIniciais() {
        Perfil admin = new Perfil(); admin.setNome("ADMIN"); admin.setDescricao("Administrador do sistema - Acesso total");
        Perfil gerente = new Perfil(); gerente.setNome("GERENTE"); gerente.setDescricao("Gerente - Acesso intermediário");
        Perfil operador = new Perfil(); operador.setNome("OPERADOR"); operador.setDescricao("Operador - Acesso operacional");
        Perfil financeiro = new Perfil(); financeiro.setNome("FINANCEIRO"); financeiro.setDescricao("Equipe financeira - Relatórios e pagamentos");

        perfilRepository.saveAll(List.of(admin, gerente, operador, financeiro));
        System.out.println("✅ 4 perfis criados.");
    }

    // ====================== USUÁRIOS ======================
    private void criarUsuariosIniciais() {
        List<Perfil> perfis = perfilRepository.findAll();
        Perfil pAdmin = perfis.stream().filter(p -> "ADMIN".equals(p.getNome())).findFirst().orElseThrow();
        Perfil pGerente = perfis.stream().filter(p -> "GERENTE".equals(p.getNome())).findFirst().orElseThrow();
        Perfil pOperador = perfis.stream().filter(p -> "OPERADOR".equals(p.getNome())).findFirst().orElseThrow();
        Perfil pFinanceiro = perfis.stream().filter(p -> "FINANCEIRO".equals(p.getNome())).findFirst().orElseThrow();

        List<Usuario> usuarios = List.of(
                criarUsuario("Administrador Sistema", "admin@agerp.com", "123456", pAdmin),
                criarUsuario("João Pedro Silva", "joao@agerp.com", "123456", pOperador),
                criarUsuario("Maria Clara Oliveira", "maria@agerp.com", "123456", pOperador),
                criarUsuario("Carlos Eduardo Mendes", "carlos@agerp.com", "123456", pGerente),
                criarUsuario("Ana Beatriz Santos", "ana@agerp.com", "123456", pFinanceiro),
                criarUsuario("Pedro Henrique Lima", "pedro@agerp.com", "123456", pOperador),
                criarUsuario("Fernanda Costa", "fernanda@agerp.com", "123456", pOperador),
                criarUsuario("Lucas Mendes Rocha", "lucas@agerp.com", "123456", pGerente),
                criarUsuario("Juliana Ferreira", "juliana@agerp.com", "123456", pFinanceiro),
                criarUsuario("Rafael Almeida", "rafael@agerp.com", "123456", pOperador),
                criarUsuario("Camila Souza", "camila@agerp.com", "123456", pOperador),
                criarUsuario("Bruno Costa", "bruno@agerp.com", "123456", pGerente)
        );

        usuarioRepository.saveAll(usuarios);
        System.out.println("✅ 12 usuários criados (senha padrão: 123456).");
    }

    private Usuario criarUsuario(String nome, String email, String senha, Perfil perfil) {
        Usuario u = new Usuario();
        u.setNome(nome);
        u.setEmail(email);
        u.setSenhaHash(passwordEncoder.encode(senha));
        u.setAtivo(true);
        u.setIdPerfil(perfil);
        return u;
    }

    // ====================== CLIENTES ======================
    private void criarClientesIniciais() {
        List<Cliente> clientes = List.of(
                criarCliente("FISICA", "João Silva", "123.456.789-01", "joao@email.com", "(11) 98765-4321"),
                criarCliente("FISICA", "Maria Oliveira", "987.654.321-00", "maria@email.com", "(11) 91234-5678"),
                criarCliente("JURIDICA", "Tech Solutions LTDA", "12.345.678/0001-90", "contato@techsol.com", "(11) 3333-4444"),
                criarCliente("FISICA", "Carlos Mendes", "456.789.123-45", "carlos@email.com", "(11) 99876-5432"),
                criarCliente("JURIDICA", "Café Expresso ME", "98.765.432/0001-10", "cafe@expresso.com", "(11) 2222-1111"),
                criarCliente("FISICA", "Ana Beatriz Santos", "321.654.987-00", "ana@email.com", "(11) 94567-8901"),
                criarCliente("JURIDICA", "Construtora ABC Ltda", "11.222.333/0001-44", "contato@abc.com", "(11) 5555-6666"),
                criarCliente("FISICA", "Pedro Henrique Lima", "789.012.345-67", "pedro@email.com", "(11) 97654-3210"),
                criarCliente("FISICA", "Fernanda Costa", "654.321.987-00", "fernanda@email.com", "(11) 93456-7890"),
                criarCliente("JURIDICA", "Supermercado Bom Preço", "55.666.777/0001-88", "contato@bompreco.com", "(11) 4444-5555")
        );

        clienteRepository.saveAll(clientes);
        System.out.println("✅ 10 clientes criados.");
    }

    private Cliente criarCliente(String tipo, String nomeRazao, String cpfCnpj, String email, String telefone) {
        Cliente c = new Cliente();
        c.setTipo(tipo);
        c.setNomeRazao(nomeRazao);
        c.setCpfCnpj(cpfCnpj);
        c.setEmail(email);
        c.setTelefone(telefone);
        return c;
    }

    // ====================== ENDEREÇOS ======================
    private void criarEnderecosIniciais() {
        List<Cliente> clientes = clienteRepository.findAll();

        List<Endereco> enderecos = List.of(
                criarEndereco(clientes.get(0), "Rua das Flores, 123", "Apto 45", "Centro", "Botucatu", "SP", "18600-010", -22.8852, -48.4458),
                criarEndereco(clientes.get(1), "Av. Paulista, 1000", "Sala 1205", "Bela Vista", "São Paulo", "SP", "01310-100", -23.5614, -46.6559),
                criarEndereco(clientes.get(2), "Rua XV de Novembro, 456", "", "Centro", "Campinas", "SP", "13010-000", -22.9056, -47.0608),
                criarEndereco(clientes.get(3), "Rua Dom Pedro I, 789", "", "Jardim América", "Ribeirão Preto", "SP", "14020-000", -21.1781, -47.8102),
                criarEndereco(clientes.get(4), "Av. Brasil, 2500", "", "Vila Industrial", "Bauru", "SP", "17012-000", -22.3475, -49.0641),
                criarEndereco(clientes.get(5), "Rua das Palmeiras, 321", "Casa 2", "Jardim Botânico", "Botucatu", "SP", "18608-000", -22.8800, -48.4500),
                criarEndereco(clientes.get(6), "Rua São Bento, 150", "", "Centro", "Sorocaba", "SP", "18010-000", -23.5015, -47.4584),
                criarEndereco(clientes.get(7), "Av. Getúlio Vargas, 987", "", "Jardim Europa", "Piracicaba", "SP", "13400-000", -22.7253, -47.6476),
                criarEndereco(clientes.get(8), "Rua Tiradentes, 654", "Bloco B", "Vila Nova", "Presidente Prudente", "SP", "19010-000", -22.1256, -51.3894),
                criarEndereco(clientes.get(9), "Rua 7 de Setembro, 1122", "", "Centro", "Marília", "SP", "17500-000", -22.2139, -49.9458)
        );

        enderecoRepository.saveAll(enderecos);
        System.out.println("✅ 10 endereços criados.");
    }

    private Endereco criarEndereco(Cliente cliente, String logradouro, String numero, String bairro,
                                   String cidade, String estado, String cep, double lat, double lon) {
        Endereco e = new Endereco();
        e.setIdCliente(cliente);
        e.setLogradouro(logradouro);
        e.setNumero(numero);
        e.setBairro(bairro);
        e.setCidade(cidade);
        e.setEstado(estado);
        e.setCep(cep);
        e.setLatitude(BigDecimal.valueOf(lat));
        e.setLongitude(BigDecimal.valueOf(lon));
        return e;
    }

    // ====================== PRODUTOS + ESTOQUE ======================
    private void criarProdutosEEstoquesIniciais() {
        List<Produto> produtos = List.of(
                criarProduto("Notebook Dell Inspiron 15", "Intel i5, 8GB RAM, 512GB SSD", new BigDecimal("3499.90"), new BigDecimal("2800.00"), new BigDecimal("2.1"), new BigDecimal("0.5")),
                criarProduto("Mouse Wireless Logitech", "Mouse sem fio ergonômico", new BigDecimal("89.90"), new BigDecimal("45.00"), new BigDecimal("0.1"), new BigDecimal("0.02")),
                criarProduto("Monitor 24\" LG Ultrawide", "Monitor 24 polegadas IPS", new BigDecimal("1299.90"), new BigDecimal("950.00"), new BigDecimal("4.5"), new BigDecimal("0.8")),
                criarProduto("Cadeira Gamer ThunderX3", "Cadeira ergonômica preta", new BigDecimal("899.90"), new BigDecimal("650.00"), new BigDecimal("15.0"), new BigDecimal("2.0")),
                criarProduto("Teclado Mecânico RGB", "Teclado mecânico com RGB", new BigDecimal("249.90"), new BigDecimal("140.00"), new BigDecimal("0.8"), new BigDecimal("0.1")),
                criarProduto("Impressora Multifuncional HP", "Impressora, scanner e copiadora", new BigDecimal("799.90"), new BigDecimal("520.00"), new BigDecimal("6.5"), new BigDecimal("0.4")),
                criarProduto("Fone de Ouvido Bluetooth JBL", "Fone sem fio com cancelamento", new BigDecimal("399.90"), new BigDecimal("220.00"), new BigDecimal("0.2"), new BigDecimal("0.05")),
                criarProduto("HD Externo 2TB Seagate", "HD externo USB 3.0", new BigDecimal("449.90"), new BigDecimal("320.00"), new BigDecimal("0.3"), new BigDecimal("0.1")),
                criarProduto("Smartphone Samsung Galaxy A55", "128GB, 6GB RAM, câmera 50MP", new BigDecimal("1899.90"), new BigDecimal("1400.00"), new BigDecimal("0.2"), new BigDecimal("0.01")),
                criarProduto("Tablet iPad 10ª Geração", "10.9\" 64GB Wi-Fi", new BigDecimal("2499.90"), new BigDecimal("2100.00"), new BigDecimal("0.5"), new BigDecimal("0.3")),
                criarProduto("Câmera GoPro Hero 12", "4K 60fps, à prova d'água", new BigDecimal("2299.90"), new BigDecimal("1700.00"), new BigDecimal("0.15"), new BigDecimal("0.05")),
                criarProduto("Roteador Wi-Fi 6 TP-Link", "AX3000, tri-band", new BigDecimal("399.90"), new BigDecimal("280.00"), new BigDecimal("0.4"), new BigDecimal("0.1")),
                criarProduto("Caixa de Som JBL Flip 6", "Portátil Bluetooth", new BigDecimal("599.90"), new BigDecimal("420.00"), new BigDecimal("0.6"), new BigDecimal("0.2")),
                criarProduto("Notebook Lenovo IdeaPad 3", "Ryzen 5, 16GB, 512GB SSD", new BigDecimal("2799.90"), new BigDecimal("2200.00"), new BigDecimal("1.8"), new BigDecimal("0.4")),
                criarProduto("Impressora a Laser Brother", "Mono, Wi-Fi, duplex", new BigDecimal("1299.90"), new BigDecimal("950.00"), new BigDecimal("7.2"), new BigDecimal("0.6"))
        );

        produtos = produtoRepository.saveAll(produtos);

        for (Produto p : produtos) {
            Estoque estoque = new Estoque();
            estoque.setIdProduto(p);
            estoque.setQuantidadeAtual(30 + random.nextInt(200));
            estoque.setQuantidadeMinima(10);
            estoque.setLocalizacao("Depósito A - Prateleira " + (random.nextInt(20) + 1));
            estoqueRepository.save(estoque);
        }

        System.out.println("✅ 15 produtos + estoques criados.");
    }

    private Produto criarProduto(String nome, String descricao, BigDecimal preco, BigDecimal custo,
                                 BigDecimal peso, BigDecimal volume) {
        Produto p = new Produto();
        p.setNome(nome);
        p.setDescricao(descricao);
        p.setPreco(preco);
        p.setCusto(custo);
        p.setPeso(peso);
        p.setVolume(volume);
        p.setAtivo(true);
        return p;
    }

    // ====================== PEDIDOS COMPLETOS (CORRIGIDO) ======================
    private void criarPedidosCompletosIniciais() {
        List<Cliente> clientes = clienteRepository.findAll();
        List<Usuario> usuarios = usuarioRepository.findAll();
        List<Produto> produtos = produtoRepository.findAll();

        for (int i = 0; i < 12; i++) {
            Cliente cliente = clientes.get(random.nextInt(clientes.size()));
            Usuario usuario = usuarios.get(random.nextInt(usuarios.size()));

            // Pedido
            Pedido pedido = new Pedido();
            pedido.setIdCliente(cliente);
            pedido.setIdUsuario(usuario);
            pedido.setStatus(random.nextBoolean() ? "CONCLUIDO" : "ENTREGUE");
            pedido.setDataPedido(Instant.now().minus(random.nextInt(30), ChronoUnit.DAYS));
            pedido = pedidoRepository.save(pedido);

            // Itens do pedido
            BigDecimal valorTotal = BigDecimal.ZERO;
            int qtdItens = 2 + random.nextInt(3);
            for (int j = 0; j < qtdItens; j++) {
                Produto produto = produtos.get(random.nextInt(produtos.size()));
                int quantidade = 1 + random.nextInt(5);

                ItemPedido item = new ItemPedido();
                item.setIdPedido(pedido);
                item.setIdProduto(produto);
                item.setQuantidade(quantidade);
                item.setPrecoUnitario(produto.getPreco());
                itemPedidoRepository.save(item);

                valorTotal = valorTotal.add(produto.getPreco().multiply(BigDecimal.valueOf(quantidade)));
            }

            pedido.setValorTotal(valorTotal);
            pedidoRepository.save(pedido);

            // Pagamento
            Pagamento pagamento = new Pagamento();
            pagamento.setIdPedido(pedido);
            pagamento.setTipoPagamento(random.nextBoolean() ? "CARTAO_CREDITO" : "PIX");
            pagamento.setValor(valorTotal);
            pagamento.setStatus("APROVADO");
            pagamento.setDataPagamento(pedido.getDataPedido().plus(2, ChronoUnit.HOURS));
            pagamentoRepository.save(pagamento);

            // Entrega
            Entrega entrega = new Entrega();
            entrega.setIdPedido(pedido);
            entrega.setDataSaida(pedido.getDataPedido().plus(1, ChronoUnit.DAYS));
            entrega.setDataEntrega(entrega.getDataSaida().plus(3 + random.nextInt(5), ChronoUnit.DAYS));
            entrega.setStatus("ENTREGUE");
            entrega.setTempoEstimadoIa(48 + random.nextInt(72));
            entrega.setTempoReal(45 + random.nextInt(80));
            entrega.setDistanciaKm(BigDecimal.valueOf(15 + random.nextDouble() * 300));
            entregaRepository.save(entrega);
        }

        System.out.println("✅ 12 pedidos completos criados (com itens, pagamentos e entregas).");
    }
}