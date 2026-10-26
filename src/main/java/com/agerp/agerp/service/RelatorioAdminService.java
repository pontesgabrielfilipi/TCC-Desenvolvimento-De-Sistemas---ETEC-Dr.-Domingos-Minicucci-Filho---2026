package com.agerp.agerp.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.OffsetDateTime;
import java.util.*;

/** Consultas SQL somente de leitura, com filtros vinculados e exportacao incremental XLSX. */
@Service
public class RelatorioAdminService {
    private static final Logger log = LoggerFactory.getLogger(RelatorioAdminService.class);
    public record Filtros(LocalDate inicio, LocalDate fim, Integer clienteId,
                          Integer produtoId, Integer usuarioId, String status) {
        public Filtros {
            if (inicio != null && fim != null && inicio.isAfter(fim))
                throw new IllegalArgumentException("Data inicial posterior a data final.");
            if (fim != null && fim.equals(LocalDate.MAX))
                throw new IllegalArgumentException("Data final invalida.");
            if (clienteId != null && clienteId <= 0 || produtoId != null && produtoId <= 0
                    || usuarioId != null && usuarioId <= 0)
                throw new IllegalArgumentException("Os identificadores dos filtros devem ser positivos.");
            status = status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
            if (status != null && (status.length() > 50 || !status.matches("[A-Z_]+")))
                throw new IllegalArgumentException("Status invalido.");
        }
    }

    /** n = inteiro, d = decimal, m = moeda, t = texto, h = data/hora, a = data; '+' soma coluna. */
    public record Coluna(String titulo, char tipo, boolean somar) {}
    public record Escopo(String data, String cliente, String produto, String usuario, String status) {}
    public record Relatorio(String id, String categoria, String titulo, String descricao,
                           String select, String from, String finalSql,
                           List<Coluna> colunas, Escopo escopo) {
        public List<String> filtros() {
            List<String> lista = new ArrayList<>();
            if (escopo.data != null) { lista.add("inicio"); lista.add("fim"); }
            if (escopo.cliente != null) lista.add("clienteId");
            if (escopo.produto != null) lista.add("produtoId");
            if (escopo.usuario != null) lista.add("usuarioId");
            if (escopo.status != null) lista.add("status");
            return lista;
        }
    }

    private static final String RECEITA = "CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN COALESCE(p.valor_total,0) ELSE 0 END";
    private static final String ITENS_VALIDOS = "CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN COALESCE(i.quantidade,0) ELSE 0 END";
    private static final String VALOR_ITENS = "CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN COALESCE(i.quantidade,0)*COALESCE(i.preco_unitario,0) ELSE 0 END";
    private static final String PEDIDOS = " FROM agerp.pedido p JOIN agerp.cliente c ON c.id_cliente=p.id_cliente LEFT JOIN agerp.usuario u ON u.id_usuario=p.id_usuario WHERE 1=1";
    private static final String ITENS = " FROM agerp.pedido p JOIN agerp.cliente c ON c.id_cliente=p.id_cliente JOIN agerp.item_pedido i ON i.id_pedido=p.id_pedido JOIN agerp.produto pr ON pr.id_produto=i.id_produto LEFT JOIN agerp.usuario u ON u.id_usuario=p.id_usuario WHERE 1=1";
    private static final String PRODUTOS = " FROM agerp.produto pr LEFT JOIN agerp.estoque e ON e.id_produto=pr.id_produto WHERE 1=1";
    private static final String MOVIMENTOS = " FROM agerp.movimentacao_estoque m JOIN agerp.produto pr ON pr.id_produto=m.id_produto LEFT JOIN agerp.usuario u ON u.id_usuario=m.id_usuario WHERE 1=1";
    private static final String LOGS = " FROM agerp.log_sistema l LEFT JOIN agerp.usuario u ON u.id_usuario=l.id_usuario WHERE 1=1";
    private static final Escopo P = new Escopo("p.data_pedido", "p.id_cliente", null, "p.id_usuario", "p.status");
    private static final Escopo I = new Escopo("p.data_pedido", "p.id_cliente", "i.id_produto", "p.id_usuario", "p.status");
    private static final Escopo PR = new Escopo(null, null, "pr.id_produto", null, null);
    private static final Escopo M = new Escopo("m.data_movimentacao", null, "m.id_produto", "m.id_usuario", null);
    private static final Escopo L = new Escopo("l.data_hora", null, null, "l.id_usuario", null);
    private static final LinkedHashMap<String, Relatorio> CATALOGO = criarCatalogo();

    private final JdbcTemplate jdbc;
    private final EstoqueBaixoService estoqueBaixo;

    public RelatorioAdminService(JdbcTemplate jdbc, EstoqueBaixoService estoqueBaixo) {
        this.jdbc = jdbc;
        this.estoqueBaixo = estoqueBaixo;
    }

    public Collection<Relatorio> catalogo() { return CATALOGO.values(); }

    public Relatorio obter(String id) {
        Relatorio report = CATALOGO.get(id);
        if (report == null) throw new IllegalArgumentException("Relatorio desconhecido: " + id);
        return report;
    }

    private static List<Coluna> colunas(String definicao) {
        return Arrays.stream(definicao.split("\\|"))
                .map(coluna -> {
                    int pos = coluna.lastIndexOf(':');
                    String tipo = coluna.substring(pos + 1);
                    return new Coluna(coluna.substring(0, pos), tipo.charAt(0), tipo.endsWith("+"));
                }).toList();
    }

    private static void add(Map<String, Relatorio> destino, String id, String grupo, String titulo,
                            String descricao, String select, String from, String finalSql,
                            String colunas, Escopo filtros) {
        destino.put(id, new Relatorio(id, grupo, titulo, descricao, select, from, finalSql,
                colunas(colunas), filtros));
    }

    private static LinkedHashMap<String, Relatorio> criarCatalogo() {
        LinkedHashMap<String, Relatorio> r = new LinkedHashMap<>();
        String cp = "c.id_cliente,c.nome_razao,c.tipo,c.cpf_cnpj,c.email,c.telefone,c.data_cadastro";
        String baseClientes = " FROM agerp.cliente c WHERE 1=1";
        Escopo cadastroCliente = new Escopo("c.data_cadastro", "c.id_cliente", null, null, null);
        add(r,"clientes_cadastro","Clientes","Cadastro de clientes","Dados cadastrais e documentos como texto.",cp,baseClientes," ORDER BY c.id_cliente",
                "Código:n|Nome / Razão social:t|Tipo:t|CPF / CNPJ:t|E-mail:t|Telefone:t|Cadastro:h",cadastroCliente);
        add(r,"clientes_tipo","Clientes","Distribuição por tipo","Contagem de clientes por tipo cadastrado.","COALESCE(c.tipo,'SEM TIPO'),COUNT(*)",baseClientes," GROUP BY c.tipo ORDER BY 2 DESC",
                "Tipo:t|Clientes:n+",cadastroCliente);
        add(r,"clientes_sem_pedidos","Clientes","Clientes sem compras","Clientes que não possuem qualquer pedido registrado.",cp,baseClientes+" AND NOT EXISTS (SELECT 1 FROM agerp.pedido p WHERE p.id_cliente=c.id_cliente)"," ORDER BY c.nome_razao",
                "Código:n|Nome / Razão social:t|Tipo:t|CPF / CNPJ:t|E-mail:t|Telefone:t|Cadastro:h",cadastroCliente);
        add(r,"clientes_historico","Clientes","Histórico de compras","Todos os pedidos dos clientes selecionados, inclusive cancelados.",
                "p.id_pedido,c.id_cliente,c.nome_razao,p.data_pedido,p.status,p.valor_total,u.nome",PEDIDOS," ORDER BY p.data_pedido DESC,p.id_pedido DESC",
                "Pedido:n|Cliente ID:n|Cliente:t|Data:h|Status:t|Valor do pedido:m+|Usuário:t",P);
        add(r,"clientes_ranking","Clientes","Ranking de clientes","Pedidos e faturamento não cancelado por cliente.",
                "c.id_cliente,c.nome_razao,COUNT(*),SUM(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN 1 ELSE 0 END),SUM("+RECEITA+")",PEDIDOS,
                " GROUP BY c.id_cliente,c.nome_razao ORDER BY 5 DESC,4 DESC",
                "Código:n|Cliente:t|Pedidos:n+|Pedidos não cancelados:n+|Faturamento:m+",P);

        add(r,"produtos_cadastro","Produtos","Cadastro de produtos","Cadastro, situação, descrição e propriedades.",
                "pr.id_produto,pr.nome,pr.descricao,pr.ativo,pr.preco,pr.peso,pr.volume",PRODUTOS," ORDER BY pr.id_produto",
                "Código:n|Produto:t|Descrição:t|Ativo:t|Preço:m|Peso:d|Volume:d",PR);
        add(r,"produtos_precos","Produtos","Tabela de preços","Preços atuais cadastrados; não é histórico de preços.",
                "pr.id_produto,pr.nome,pr.preco,pr.ativo",PRODUTOS," ORDER BY pr.nome",
                "Código:n|Produto:t|Preço:m|Ativo:t",PR);
        add(r,"produtos_custos","Produtos","Custos unitários cadastrados","Custo unitário atual informado no cadastro, sem inferir lucro ou custo histórico.",
                "pr.id_produto,pr.nome,pr.custo,pr.ativo",PRODUTOS," ORDER BY pr.nome",
                "Código:n|Produto:t|Custo unitário atual:m|Ativo:t",PR);
        String minimo = "{MINIMO}";
        String estoqueSelect = "pr.id_produto,pr.nome,pr.ativo,e.quantidade_atual,e.quantidade_minima,"+minimo+",e.localizacao";
        String estoqueColunas = "Código:n|Produto:t|Ativo:t|Estoque atual:n+|Mínimo individual:n|Mínimo aplicado:n|Localização:t";
        add(r,"produtos_estoque","Produtos","Estoque atual","Saldos cadastrados e mínimo efetivo da configuração.",
                estoqueSelect,PRODUTOS," ORDER BY pr.nome",estoqueColunas,PR);
        add(r,"produtos_estoque_baixo","Produtos","Estoque baixo","Somente saldos abaixo do mínimo aplicado; saldo ausente não é zero.",
                estoqueSelect,PRODUTOS+" AND e.quantidade_atual IS NOT NULL AND e.quantidade_atual < "+minimo,
                " ORDER BY e.quantidade_atual,pr.nome",estoqueColunas,PR);
        add(r,"produtos_ranking","Produtos","Ranking de produtos","Quantidade e valor de itens em pedidos não cancelados.",
                "pr.id_produto,pr.nome,SUM("+ITENS_VALIDOS+"),SUM("+VALOR_ITENS+")",ITENS,
                " GROUP BY pr.id_produto,pr.nome ORDER BY 3 DESC,4 DESC",
                "Código:n|Produto:t|Unidades:n+|Valor dos itens:m+",I);

        String movCols = "Movimento:n|Data:h|Tipo:t|Produto ID:n|Produto:t|Quantidade:n+|Usuário ID:n|Usuário:t";
        String movSelect = "m.id_movimentacao,m.data_movimentacao,m.tipo,pr.id_produto,pr.nome,m.quantidade,u.id_usuario,u.nome";
        add(r,"estoque_movimentacoes","Estoque","Todas as movimentações","Entradas, saídas e ajustes registrados.",movSelect,MOVIMENTOS," ORDER BY m.data_movimentacao DESC,m.id_movimentacao DESC",movCols,M);
        add(r,"estoque_entradas","Estoque","Entradas de estoque","Movimentos com tipo ENTRADA.",movSelect,MOVIMENTOS+" AND UPPER(m.tipo)='ENTRADA'"," ORDER BY m.data_movimentacao DESC",movCols,M);
        add(r,"estoque_saidas","Estoque","Saídas de estoque","Movimentos com tipo SAIDA.",movSelect,MOVIMENTOS+" AND UPPER(m.tipo)='SAIDA'"," ORDER BY m.data_movimentacao DESC",movCols,M);
        add(r,"estoque_por_produto","Estoque","Movimentos por produto","Entradas, saídas e quantidade de movimentos por produto.",
                "pr.id_produto,pr.nome,COUNT(*),SUM(CASE WHEN UPPER(m.tipo)='ENTRADA' THEN m.quantidade ELSE 0 END),SUM(CASE WHEN UPPER(m.tipo)='SAIDA' THEN m.quantidade ELSE 0 END)",
                MOVIMENTOS," GROUP BY pr.id_produto,pr.nome ORDER BY pr.nome",
                "Código:n|Produto:t|Movimentos:n+|Entradas:n+|Saídas:n+",M);

        String pedidoCols = "Pedido:n|Data:h|Cliente ID:n|Cliente:t|Status:t|Valor do pedido:m+|Usuário ID:n|Usuário:t";
        String pedidoSelect = "p.id_pedido,p.data_pedido,c.id_cliente,c.nome_razao,p.status,p.valor_total,u.id_usuario,u.nome";
        add(r,"pedidos_geral","Pedidos","Relação de pedidos","Todos os pedidos, independentemente do status.",pedidoSelect,PEDIDOS," ORDER BY p.data_pedido DESC,p.id_pedido DESC",pedidoCols,P);
        add(r,"pedidos_itens","Pedidos","Itens dos pedidos","Preços históricos e subtotais por item, sem confundir com recebimentos.",
                "p.id_pedido,p.data_pedido,p.status,c.nome_razao,pr.id_produto,pr.nome,i.quantidade,i.preco_unitario,i.quantidade*i.preco_unitario",ITENS,
                " ORDER BY p.id_pedido DESC,i.id_item",
                "Pedido:n|Data:h|Status:t|Cliente:t|Produto ID:n|Produto:t|Quantidade:n+|Preço unitário:m|Subtotal:m+",I);
        add(r,"pedidos_status","Pedidos","Distribuição por status","Contagem e valor de face dos pedidos por status.",
                "COALESCE(p.status,'SEM STATUS'),COUNT(*),SUM(COALESCE(p.valor_total,0))",PEDIDOS," GROUP BY p.status ORDER BY 2 DESC",
                "Status:t|Pedidos:n+|Valor dos pedidos:m+",P);
        add(r,"pedidos_pendentes","Pedidos","Pedidos pendentes","Somente PENDENTE.",pedidoSelect,PEDIDOS+" AND UPPER(p.status)='PENDENTE'"," ORDER BY p.data_pedido DESC",pedidoCols,P);
        add(r,"pedidos_andamento","Pedidos","Pedidos em andamento","Confirmados, em preparação, prontos e status legado EM_ANDAMENTO.",pedidoSelect,
                PEDIDOS+" AND UPPER(p.status) IN ('CONFIRMADO','EM_PREPARACAO','PRONTO','EM_ANDAMENTO')"," ORDER BY p.data_pedido DESC",pedidoCols,P);
        add(r,"pedidos_concluidos","Pedidos","Pedidos concluídos","Somente ENTREGUE.",pedidoSelect,PEDIDOS+" AND UPPER(p.status)='ENTREGUE'"," ORDER BY p.data_pedido DESC",pedidoCols,P);
        add(r,"pedidos_cancelados","Pedidos","Pedidos cancelados","Somente CANCELADO.",pedidoSelect,PEDIDOS+" AND UPPER(p.status)='CANCELADO'"," ORDER BY p.data_pedido DESC",pedidoCols,P);

        add(r,"vendas_periodo","Vendas","Vendas por dia","Faturamento exclui CANCELADO; pedidos totais são mostrados separadamente.",
                "CAST(p.data_pedido AS DATE),COUNT(*),SUM(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN 1 ELSE 0 END),SUM("+RECEITA+")",PEDIDOS,
                " GROUP BY CAST(p.data_pedido AS DATE) ORDER BY 1",
                "Dia:a|Pedidos:n+|Pedidos não cancelados:n+|Faturamento:m+",P);
        add(r,"vendas_cliente","Vendas","Vendas por cliente","Totais não cancelados, com quantidade total de pedidos.",
                "c.id_cliente,c.nome_razao,COUNT(*),SUM(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN 1 ELSE 0 END),SUM("+RECEITA+")",PEDIDOS,
                " GROUP BY c.id_cliente,c.nome_razao ORDER BY 5 DESC",
                "Código:n|Cliente:t|Pedidos:n+|Pedidos não cancelados:n+|Faturamento:m+",P);
        add(r,"vendas_produto","Vendas","Vendas por produto","Quantidade e valor dos itens de pedidos não cancelados.",
                "pr.id_produto,pr.nome,SUM("+ITENS_VALIDOS+"),SUM("+VALOR_ITENS+")",ITENS,
                " GROUP BY pr.id_produto,pr.nome ORDER BY 4 DESC",
                "Código:n|Produto:t|Unidades:n+|Valor dos itens:m+",I);
        add(r,"vendas_usuario","Vendas","Vendas por usuário","Pedidos e faturamento por operador, inclusive pedidos sem usuário.",
                "u.id_usuario,COALESCE(u.nome,'Sem usuário'),COUNT(*),SUM(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN 1 ELSE 0 END),SUM("+RECEITA+")",PEDIDOS,
                " GROUP BY u.id_usuario,u.nome ORDER BY 5 DESC",
                "Usuário ID:n|Usuário:t|Pedidos:n+|Pedidos não cancelados:n+|Faturamento:m+",P);
        add(r,"vendas_evolucao","Vendas","Evolução mensal","Evolução por mês de criação do pedido.",
                "CAST(DATE_TRUNC('month',p.data_pedido) AS DATE),COUNT(*),SUM("+RECEITA+")",PEDIDOS,
                " GROUP BY DATE_TRUNC('month',p.data_pedido) ORDER BY 1",
                "Mês:a|Pedidos:n+|Faturamento:m+",P);

        add(r,"indicadores_resumo","Indicadores","Indicadores gerais","Faturamento e ticket médio excluem cancelados; unidades consideram itens não cancelados.",
                "COUNT(*),SUM(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN 1 ELSE 0 END),SUM("+RECEITA+"),COALESCE(AVG(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN p.valor_total END),0),"+
                "(SELECT COALESCE(SUM("+ITENS_VALIDOS+"),0) FROM agerp.item_pedido i JOIN agerp.pedido p ON p.id_pedido=i.id_pedido WHERE 1=1 {ITEM_FILTERS})",PEDIDOS,"",
                "Pedidos:n+|Pedidos não cancelados:n+|Faturamento:m+|Ticket médio:m|Unidades vendidas:n+",P);
        add(r,"indicadores_desempenho","Indicadores","Desempenho por operador","Faturamento, pedidos válidos e ticket médio por usuário.",
                "u.id_usuario,COALESCE(u.nome,'Sem usuário'),COUNT(*),SUM(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN 1 ELSE 0 END),SUM("+RECEITA+"),COALESCE(AVG(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN p.valor_total END),0)",PEDIDOS,
                " GROUP BY u.id_usuario,u.nome ORDER BY 5 DESC",
                "Usuário ID:n|Usuário:t|Pedidos:n+|Pedidos não cancelados:n+|Faturamento:m+|Ticket médio:m",P);

        Escopo usuario = new Escopo("u.data_criacao", null, null, "u.id_usuario", null);
        add(r,"usuarios_cadastro","Usuários","Cadastro de usuários","Nome, e-mail, cargo e situação, sem credenciais.",
                "u.id_usuario,u.nome,u.email,per.nome,per.nivel_autoridade,u.ativo,u.status_acesso,u.data_criacao",
                " FROM agerp.usuario u JOIN agerp.perfil per ON per.id_perfil=u.id_perfil WHERE 1=1", " ORDER BY u.id_usuario",
                "Código:n|Usuário:t|E-mail:t|Cargo:t|Nível:n|Ativo:t|Acesso:t|Cadastro:h",usuario);
        add(r,"usuarios_cargos","Usuários","Cargos e permissões","Cargos atuais, níveis e páginas autorizadas (sem segredos).",
                "per.id_perfil,per.nome,per.descricao,per.nivel_autoridade,per.protegido,COUNT(DISTINCT u.id_usuario),STRING_AGG(DISTINCT pp.pagina,', ' ORDER BY pp.pagina)",
                " FROM agerp.perfil per LEFT JOIN agerp.usuario u ON u.id_perfil=per.id_perfil LEFT JOIN agerp.perfil_pagina pp ON pp.id_perfil=per.id_perfil WHERE 1=1",
                " GROUP BY per.id_perfil,per.nome,per.descricao,per.nivel_autoridade,per.protegido ORDER BY per.nivel_autoridade DESC",
                "Código:n|Cargo:t|Descrição:t|Nível:n|Protegido:t|Usuários:n+|Páginas autorizadas:t",new Escopo(null,null,null,null,null));
        add(r,"usuarios_situacao","Usuários","Situação de acesso","Contagem de usuários por cargo, aprovação e atividade.",
                "per.nome,u.status_acesso,u.ativo,COUNT(*)", " FROM agerp.usuario u JOIN agerp.perfil per ON per.id_perfil=u.id_perfil WHERE 1=1",
                " GROUP BY per.nome,u.status_acesso,u.ativo ORDER BY per.nome,u.status_acesso",
                "Cargo:t|Acesso:t|Ativo:t|Usuários:n+",usuario);
        add(r,"usuarios_atividade","Usuários","Atividade registrada","Eventos de auditoria atribuídos a usuários (não mede tempo trabalhado).",
                "l.id_log,l.data_hora,COALESCE(l.usuario_nome,u.nome),COALESCE(l.usuario_email,u.email),l.acao,l.entidade,l.recurso_id,l.resultado",LOGS,
                " ORDER BY l.data_hora DESC,l.id_log DESC",
                "Log ID:n|Data:h|Usuário:t|E-mail:t|Ação:t|Entidade:t|Recurso:t|Resultado:t",L);
        add(r,"auditoria_logs","Auditoria","Logs de auditoria","Eventos registrados, resultado e IP. Sem hashes ou tokens.",
                "l.id_log,l.data_hora,COALESCE(l.usuario_nome,u.nome),COALESCE(l.usuario_email,u.email),l.acao,l.entidade,l.recurso_id,l.resultado,l.ip,"+
                "l.event_id,l.request_id,l.correlation_id,l.session_ref,l.device_ref,l.peer_ip,l.http_method,l.http_route,l.http_status,l.duration_ms",LOGS,
                " ORDER BY l.data_hora DESC,l.id_log DESC",
                "Log ID:n|Data:h|Usuário:t|E-mail:t|Ação:t|Entidade:t|Recurso:t|Resultado:t|IP:t|Evento ID:t|Request ID:t|Correlação:t|Sessão:t|Dispositivo:t|IP de origem:t|Método:t|Rota:t|HTTP status:n|Duração (ms):n",L);
        add(r,"auditoria_autenticacoes","Auditoria","Eventos de autenticação","Logins, recusas, saídas e revogações efetivamente registrados.",
                "l.id_log,l.data_hora,COALESCE(l.usuario_nome,u.nome),l.acao,l.resultado,l.session_ref,l.request_id,l.ip",LOGS+
                " AND (l.acao IN ('LOGIN','LOGOUT','LOGIN_NEGADO','LOGIN_FALHA','REVOGACAO_SESSAO') OR l.entidade='AUTENTICACAO')",
                " ORDER BY l.data_hora DESC,l.id_log DESC",
                "Log ID:n|Data:h|Usuário:t|Evento:t|Resultado:t|Sessão:t|Request ID:t|IP:t",L);
        add(r,"auditoria_alteracoes","Auditoria","Alterações auditadas","Alterações com diferenças sanitizadas, registradas a partir da auditoria correlacionada.",
                "l.id_log,l.data_hora,COALESCE(l.usuario_nome,u.nome),l.acao,l.entidade,l.recurso_id,l.resultado,l.changes_json::text,l.request_id",LOGS+
                " AND l.changes_json IS NOT NULL AND l.changes_json <> '{}'::jsonb AND l.acao NOT LIKE 'EXPORTACAO_%'",
                " ORDER BY l.data_hora DESC,l.id_log DESC",
                "Log ID:n|Data:h|Usuário:t|Ação:t|Entidade:t|Recurso:t|Resultado:t|Mudanças sanitizadas:t|Request ID:t",L);
        add(r,"auditoria_exportacoes","Auditoria","Histórico de exportações","Estados observados no servidor; transmissão não confirma download salvo.",
                "l.id_log,l.data_hora,COALESCE(l.usuario_nome,u.nome),l.acao,l.recurso_id,l.resultado,l.request_id,l.session_ref,l.changes_json::text",LOGS+
                " AND l.entidade='RELATORIO' AND l.acao LIKE 'EXPORTACAO_%'",
                " ORDER BY l.data_hora DESC,l.id_log DESC",
                "Log ID:n|Data:h|Usuário:t|Estado:t|Export ID:t|Resultado:t|Request ID:t|Sessão:t|Metadados sanitizados:t",L);
        add(r,"auditoria_sessoes","Auditoria","Sessões registradas","Sessões persistidas, datas de criação, validade e revogação; sem tokens.",
                "s.id,s.id_usuario,u.nome,s.criada_em,s.expira_em,s.revogada_em,s.motivo_revogacao,s.device_ref",
                " FROM agerp.sessao_autenticacao s JOIN agerp.usuario u ON u.id_usuario=s.id_usuario WHERE 1=1",
                " ORDER BY s.criada_em DESC,s.id DESC",
                "Sessão:t|Usuário ID:n|Usuário:t|Criada em:h|Expira em:h|Revogada em:h|Motivo:t|Dispositivo:t",
                new Escopo("s.criada_em",null,null,"s.id_usuario",null));
        add(r,"entregas_registradas","Logística","Entregas registradas","Status, datas e distância das entregas cadastradas; não são recebimentos.",
                "e.id_entrega,p.id_pedido,c.nome_razao,e.status,e.data_saida,e.data_entrega,e.tempo_estimado_ia,e.tempo_real,e.distancia_km",
                " FROM agerp.entrega e JOIN agerp.pedido p ON p.id_pedido=e.id_pedido JOIN agerp.cliente c ON c.id_cliente=p.id_cliente WHERE 1=1",
                " ORDER BY p.data_pedido DESC",
                "Entrega:n|Pedido:n|Cliente:t|Status da entrega:t|Saída:h|Entrega:h|Estimativa IA (dias):n|Tempo real (dias):n|Distância (km):d",
                new Escopo("p.data_pedido","p.id_cliente",null,"p.id_usuario","p.status"));
        return r;
    }

    public record Consulta(String sql, List<Object> parametros) {}

    public Consulta consulta(Relatorio relatorio, Filtros filtros) {
        return consulta(relatorio, filtros, usaRegraEstoque(relatorio) ? estoqueBaixo.regraAtual() : null, null);
    }

    private Consulta consulta(Relatorio relatorio, Filtros filtros, EstoqueBaixoService.Regra regra, Long limiteAuditoria) {
        String minimo = regra == null ? null : regra.usarGeral() ? Integer.toString(regra.limiteGeral())
                : "COALESCE(e.quantidade_minima," + EstoqueBaixoService.MINIMO_INDIVIDUAL_PADRAO + ")";
        Escopo escopo = relatorio.escopo();
        StringBuilder sql = new StringBuilder("SELECT ").append(relatorio.select()).append(relatorio.from());
        List<Object> params = new ArrayList<>();
        adicionarCondicoes(sql, params, escopo, filtros);
        if (limiteAuditoria != null && relatorio.from().contains("agerp.log_sistema l")) {
            sql.append(" AND l.id_log <= ?");
            params.add(limiteAuditoria);
        }
        sql.append(relatorio.finalSql());
        // Campos de configuracao sao tipados (inteiro) e nunca chegam diretamente do request.
        String finalSql = minimo == null ? sql.toString() : sql.toString().replace("{MINIMO}", minimo);
        if (finalSql.contains("{ITEM_FILTERS}")) {
            // A subconsulta deve receber os mesmos filtros de pedidos, na mesma ordem dos parametros.
            StringBuilder itens = new StringBuilder();
            List<Object> paramsItens = new ArrayList<>();
            adicionarCondicoes(itens, paramsItens, P, filtros);
            finalSql = finalSql.replace("{ITEM_FILTERS}", itens.toString());
            // Placeholders da subconsulta aparecem ANTES dos da consulta externa no SELECT.
            paramsItens.addAll(params);
            params = paramsItens;
        }
        // As medidas de unidades seguem a mesma excecao da aba Estatisticas para CANCELADO explicito.
        if ("CANCELADO".equals(filtros.status()) && relatorio.id().matches("(produtos_ranking|vendas_produto|indicadores_resumo)")) {
            finalSql = finalSql.replace(ITENS_VALIDOS, "COALESCE(i.quantidade,0)")
                    .replace(VALOR_ITENS, "COALESCE(i.quantidade,0)*COALESCE(i.preco_unitario,0)");
        }
        return new Consulta(finalSql, List.copyOf(params));
    }

    private static boolean usaRegraEstoque(Relatorio relatorio) {
        return relatorio.select().contains("{MINIMO}") || relatorio.from().contains("{MINIMO}")
                || relatorio.finalSql().contains("{MINIMO}");
    }

    private static void adicionarCondicoes(StringBuilder sql, List<Object> valores, Escopo e, Filtros f) {
        // Sessões são TIMESTAMPTZ (UTC explícito); tabelas legadas usam TIMESTAMP sem fuso.
        if (f.inicio() != null && e.data() != null) { sql.append(" AND ").append(e.data()).append(" >= ?"); valores.add(limiteData(e.data(), f.inicio())); }
        if (f.fim() != null && e.data() != null) { sql.append(" AND ").append(e.data()).append(" < ?"); valores.add(limiteData(e.data(), f.fim().plusDays(1))); }
        if (f.clienteId() != null && e.cliente() != null) { sql.append(" AND ").append(e.cliente()).append(" = ?"); valores.add(f.clienteId()); }
        if (f.produtoId() != null && e.produto() != null) { sql.append(" AND ").append(e.produto()).append(" = ?"); valores.add(f.produtoId()); }
        if (f.usuarioId() != null && e.usuario() != null) { sql.append(" AND ").append(e.usuario()).append(" = ?"); valores.add(f.usuarioId()); }
        if (f.status() != null && e.status() != null) { sql.append(" AND UPPER(").append(e.status()).append(") = ?"); valores.add(f.status()); }
    }

    private static Object limiteData(String campo, LocalDate dia) {
        return campo.startsWith("s.") ? dia.atStartOfDay().atOffset(ZoneOffset.UTC) : dia.atStartOfDay();
    }

    @Transactional(readOnly = true)
    public void exportar(Relatorio relatorio, Filtros filtros, OutputStream destino) throws IOException {
        exportarComContagem(relatorio, filtros, destino, null);
    }

    /** Limite capturado antes dos eventos desta exportação, evitando autorreferência nos logs. */
    public long corteAuditoria() {
        Long id = jdbc.queryForObject("SELECT COALESCE(MAX(id_log),0) FROM agerp.log_sistema", Long.class);
        return id == null ? 0L : id;
    }

    @Transactional(readOnly = true)
    public int exportarComContagem(Relatorio relatorio, Filtros filtros, OutputStream destino,
                                   Long limiteAuditoria) throws IOException {
        EstoqueBaixoService.Regra regra = usaRegraEstoque(relatorio) ? estoqueBaixo.regraAtual() : null;
        Consulta consulta = consulta(relatorio, filtros, regra, limiteAuditoria);
        // SXSSF mantem somente 100 linhas em memoria e descarta os arquivos temporarios ao terminar.
        SXSSFWorkbook wb = new SXSSFWorkbook(100);
        wb.setCompressTempFiles(true);
        try {
            Styles styles = new Styles(wb);
            Sheet resumo = wb.createSheet("Informações");
            String[] etiquetas = {"Relatório", "Categoria", "Gerado em", "Data inicial", "Data final",
                    "Cliente ID", "Produto ID", "Usuário ID", "Status", "Regra de faturamento", "Regra do estoque"};
            Object[] conteudo = {relatorio.titulo(), relatorio.categoria(), LocalDateTime.now(),
                    filtros.inicio(), filtros.fim(), filtros.clienteId(), filtros.produtoId(),
                    filtros.usuarioId(), filtros.status(), "Soma de pedidos não CANCELADO; ticket médio entre pedidos não cancelados.",
                    regra == null ? "Não se aplica a este relatório."
                            : regra.usarGeral() ? "Mínimo geral: " + regra.limiteGeral()
                            : "Mínimo individual (sem valor: 10); estoque baixo quando atual < mínimo."};
            for (int x = 0; x < etiquetas.length; x++) {
                Row row = resumo.createRow(x);
                Cell label = row.createCell(0); label.setCellValue(etiquetas[x]); label.setCellStyle(styles.header);
                escrever(row.createCell(1), conteudo[x], conteudo[x] instanceof LocalDate ? 'a'
                        : conteudo[x] instanceof LocalDateTime ? 'h' : 't', styles);
            }
            resumo.setColumnWidth(0, 6500); resumo.setColumnWidth(1, 18500);
            final int maxLinhas = 1_048_575; // linha de cabecalho ocupa uma das 1.048.576 linhas
            final int[] totalLinhas = {0};
            final Sheet[] atual = {criarAba(wb, 1, relatorio, styles)};
            final Map<Integer, BigDecimal> totais = new LinkedHashMap<>();
            jdbc.query(con -> {
                var ps = con.prepareStatement(consulta.sql(), ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY);
                ps.setFetchSize(500);
                int pos = 1;
                for (Object valor : consulta.parametros()) ps.setObject(pos++, valor);
                return ps;
            }, rs -> {
                int indice = totalLinhas[0] % maxLinhas;
                if (indice == 0 && totalLinhas[0] != 0)
                    atual[0] = criarAba(wb, totalLinhas[0] / maxLinhas + 1, relatorio, styles);
                Row row = atual[0].createRow(indice + 1);
                for (int col = 0; col < relatorio.colunas().size(); col++) {
                    Coluna definicao = relatorio.colunas().get(col);
                    Object valor = rs.getObject(col + 1);
                    escrever(row.createCell(col), valor, definicao.tipo(), styles);
                    if (definicao.somar() && valor instanceof Number numero)
                        totais.merge(col, new BigDecimal(numero.toString()), BigDecimal::add);
                }
                totalLinhas[0]++;
            });
            Row contagem = resumo.createRow(etiquetas.length + 1);
            contagem.createCell(0).setCellValue("Registros exportados");
            contagem.createCell(1).setCellValue(totalLinhas[0]);
            if (totalLinhas[0] == 0) {
                atual[0].createRow(1).createCell(0).setCellValue("Nenhum registro para os filtros informados.");
            }
            // Totais em aba propria permitem ultrapassar o limite de linhas de cada aba sem perda.
            Sheet total = wb.createSheet("Totais");
            Row titulo = total.createRow(0); titulo.createCell(0).setCellValue("Indicador"); titulo.createCell(1).setCellValue("Total");
            for (Cell c : titulo) c.setCellStyle(styles.header);
            int linha = 1;
            for (var entrada : totais.entrySet()) {
                Row row = total.createRow(linha++);
                Coluna col = relatorio.colunas().get(entrada.getKey());
                row.createCell(0).setCellValue(col.titulo());
                escrever(row.createCell(1), entrada.getValue(), col.tipo(), styles);
            }
            total.setColumnWidth(0, 10000); total.setColumnWidth(1, 5500); total.createFreezePane(0,1);
            wb.write(destino);
            return totalLinhas[0];
        } catch (IOException | RuntimeException erro) {
            log.error("Erro ao gerar XLSX do relatorio {} com filtros {}", relatorio.id(), filtros, erro);
            throw erro;
        } finally {
            try { wb.close(); } finally { wb.dispose(); }
        }
    }

    private static Sheet criarAba(SXSSFWorkbook wb, int indice, Relatorio report, Styles styles) {
        Sheet sheet = wb.createSheet("Dados " + indice);
        Row cabecalho = sheet.createRow(0);
        int i = 0;
        for (Coluna coluna : report.colunas()) {
            Cell c = cabecalho.createCell(i); c.setCellValue(coluna.titulo()); c.setCellStyle(styles.header);
            sheet.setColumnWidth(i, Math.min(15000, Math.max(4000, (coluna.titulo().length() + 4) * 280)));
            i++;
        }
        sheet.createFreezePane(0, 1);
        sheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, report.colunas().size()-1));
        return sheet;
    }

    private static void escrever(Cell cell, Object valor, char tipo, Styles styles) {
        if (valor == null) { cell.setBlank(); return; }
        if (tipo == 'h' || tipo == 'a') {
            LocalDateTime data = valor instanceof Instant t ? LocalDateTime.ofInstant(t, ZoneOffset.UTC)
                    : valor instanceof java.time.OffsetDateTime t ? LocalDateTime.ofInstant(t.toInstant(), ZoneOffset.UTC)
                    : valor instanceof Timestamp t ? t.toLocalDateTime()
                    : valor instanceof LocalDateTime t ? t
                    : valor instanceof java.sql.Date d ? d.toLocalDate().atStartOfDay()
                    : valor instanceof LocalDate d ? d.atStartOfDay() : null;
            if (data != null) { cell.setCellValue(data); cell.setCellStyle(tipo == 'h' ? styles.dataHora : styles.data); return; }
        }
        if (tipo != 't' && valor instanceof Number numero) {
            cell.setCellValue(numero.doubleValue());
            cell.setCellStyle(tipo == 'm' ? styles.moeda : tipo == 'd' ? styles.decimal : styles.inteiro);
            return;
        }
        if (valor instanceof Boolean b) cell.setCellValue(b ? "Sim" : "Não");
        else {
            // Todos os valores externos sao gravados como STRING; jamais criar formula.
            String texto = valor.toString();
            cell.setCellValue(texto.length() > 32767 ? texto.substring(0, 32767) : texto);
        }
    }

    private static class Styles {
        final CellStyle header, moeda, decimal, inteiro, data, dataHora;
        Styles(Workbook wb) {
            DataFormat format = wb.createDataFormat();
            header = wb.createCellStyle();
            Font fonte = wb.createFont(); fonte.setBold(true); header.setFont(fonte);
            header.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            moeda = wb.createCellStyle(); moeda.setDataFormat(format.getFormat("\"R$\" #,##0.00"));
            decimal = wb.createCellStyle(); decimal.setDataFormat(format.getFormat("#,##0.00"));
            inteiro = wb.createCellStyle(); inteiro.setDataFormat(format.getFormat("#,##0"));
            data = wb.createCellStyle(); data.setDataFormat(format.getFormat("dd/mm/yyyy"));
            dataHora = wb.createCellStyle(); dataHora.setDataFormat(format.getFormat("dd/mm/yyyy hh:mm"));
        }
    }
}
