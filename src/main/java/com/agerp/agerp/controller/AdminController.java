package com.agerp.agerp.controller;

import com.agerp.agerp.dto.LogSistemaResponse;
import com.agerp.agerp.dto.UsuarioResponse;
import com.agerp.agerp.dto.RedefinicaoSenhaResponse;
import com.agerp.agerp.dto.UsuarioUpdateRequest;
import com.agerp.agerp.dto.PerfilResponse;
import com.agerp.agerp.dto.PerfilSaveRequest;
import com.agerp.agerp.dto.AdminEstatisticasResponse;
import com.agerp.agerp.dto.ConfiguracaoSistemaRequest;
import com.agerp.agerp.dto.ConfiguracaoSistemaResponse;
import com.agerp.agerp.service.AdminService;
import com.agerp.agerp.service.ConfiguracaoSistemaService;
import com.agerp.agerp.service.DiagnosticoSistemaService;
import com.agerp.agerp.service.PerfilService;
import jakarta.validation.Valid;
import com.agerp.agerp.service.LogSistemaService;
import com.agerp.agerp.service.UsuarioService;
import com.agerp.agerp.service.RelatorioAdminService;
import com.agerp.agerp.service.ExportacaoAuditoriaService;
import com.agerp.agerp.service.ExportacaoTemporarios;
import com.agerp.agerp.service.ExportacaoFluxo;
import com.agerp.agerp.config.ExportacaoAsyncCleanupFilter;
import com.agerp.agerp.security.AuditRequestContext;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.security.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.cache.CacheManager;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.List;
import java.util.Map;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.CountDownLatch;
import java.util.zip.ZipFile;
import java.util.zip.ZipEntry;
import java.util.zip.CRC32;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")   // ← Mudança importante aqui
public class AdminController {
    private static final Logger LOGGER = LoggerFactory.getLogger(AdminController.class);
    // Restrição explícita para não saturar threads, disco e conexões JDBC com XLSX grandes.
    private final Semaphore exportacoes;

    private final AdminService adminService;
    private final UsuarioService usuarioService;
    private final LogSistemaService logSistemaService;
    private final PerfilService perfilService;
    private final ClientIpResolver clientIpResolver;
    private final ConfiguracaoSistemaService configuracaoSistemaService;
    private final DiagnosticoSistemaService diagnosticoSistemaService;
    private final CacheManager cacheManager;
    private final RelatorioAdminService relatorioAdminService;
    private final ExportacaoAuditoriaService exportacaoAuditoria;
    private final ExportacaoTemporarios exportacaoTemporarios;
    private final ThreadPoolTaskExecutor mvcExecutor;

    public AdminController(AdminService adminService, UsuarioService usuarioService,
            LogSistemaService logSistemaService, PerfilService perfilService,
            ClientIpResolver clientIpResolver, ConfiguracaoSistemaService configuracaoSistemaService,
            DiagnosticoSistemaService diagnosticoSistemaService, CacheManager cacheManager,
            RelatorioAdminService relatorioAdminService, ExportacaoAuditoriaService exportacaoAuditoria,
            ExportacaoTemporarios exportacaoTemporarios,
            @Qualifier("exportacaoMvcExecutor") ThreadPoolTaskExecutor mvcExecutor,
            @Qualifier("exportacaoVagas") Semaphore exportacoes) {
        this.adminService = adminService;
        this.usuarioService = usuarioService;
        this.logSistemaService = logSistemaService;
        this.perfilService = perfilService;
        this.clientIpResolver = clientIpResolver;
        this.configuracaoSistemaService = configuracaoSistemaService;
        this.diagnosticoSistemaService = diagnosticoSistemaService;
        this.cacheManager = cacheManager;
        this.relatorioAdminService = relatorioAdminService;
        this.exportacaoAuditoria = exportacaoAuditoria;
        this.exportacaoTemporarios = exportacaoTemporarios;
        this.mvcExecutor = mvcExecutor;
        this.exportacoes = exportacoes;
    }

    @GetMapping("/usuarios")
    public ResponseEntity<List<UsuarioResponse>> listarUsuarios(
            @RequestParam(defaultValue = "false") boolean refresh) {
        return ResponseEntity.ok(refresh ? usuarioService.recarregarTodos() : usuarioService.listarTodos());
    }

    @GetMapping("/usuarios/ativos")
    public ResponseEntity<List<UsuarioResponse>> listarUsuariosAtivos() {
        return ResponseEntity.ok(usuarioService.listarAtivos());
    }

    @GetMapping("/perfis")
    public ResponseEntity<List<PerfilResponse>> listarPerfis() {
        return ResponseEntity.ok(perfilService.listarTodos());
    }

    @PostMapping("/perfis")
    public ResponseEntity<PerfilResponse> criarCargo(@Valid @RequestBody PerfilSaveRequest request) {
        return ResponseEntity.status(201).body(perfilService.criarPersonalizado(request));
    }

    @PutMapping("/perfis/{id}")
    public ResponseEntity<PerfilResponse> editarCargo(@PathVariable Integer id,
            @Valid @RequestBody PerfilSaveRequest request) {
        return ResponseEntity.ok(perfilService.editar(id, request));
    }

    @DeleteMapping("/perfis/{id}")
    public ResponseEntity<Void> excluirCargo(@PathVariable Integer id) {
        perfilService.excluir(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/usuarios/{id}")
    public ResponseEntity<UsuarioResponse> atualizarUsuario(@PathVariable Integer id,
            @Valid @RequestBody UsuarioUpdateRequest request,
            @AuthenticationPrincipal CustomUserDetails admin, HttpServletRequest httpRequest) {
        return ResponseEntity.ok(usuarioService.atualizar(id, request,
                admin.getUsuario(), clientIpResolver.resolve(httpRequest)));
    }

    @PostMapping("/usuarios/{id}/aprovar")
    public ResponseEntity<UsuarioResponse> aprovar(@PathVariable Integer id,
            @AuthenticationPrincipal CustomUserDetails admin, HttpServletRequest request) {
        return ResponseEntity.ok(usuarioService.alterarStatus(id, StatusAcesso.APROVADO,
                admin.getUsuario(), clientIpResolver.resolve(request)));
    }

    @PostMapping("/usuarios/{id}/rejeitar")
    public ResponseEntity<UsuarioResponse> rejeitar(@PathVariable Integer id,
            @AuthenticationPrincipal CustomUserDetails admin, HttpServletRequest request) {
        return ResponseEntity.ok(usuarioService.alterarStatus(id, StatusAcesso.REJEITADO,
                admin.getUsuario(), clientIpResolver.resolve(request)));
    }

    @PostMapping("/usuarios/{id}/bloquear")
    public ResponseEntity<UsuarioResponse> bloquear(@PathVariable Integer id,
            @AuthenticationPrincipal CustomUserDetails admin, HttpServletRequest request) {
        return ResponseEntity.ok(usuarioService.alterarStatus(id, StatusAcesso.BLOQUEADO,
                admin.getUsuario(), clientIpResolver.resolve(request)));
    }

    @PostMapping("/usuarios/{id}/redefinir-senha")
    public ResponseEntity<RedefinicaoSenhaResponse> redefinirSenha(@PathVariable Integer id,
            @AuthenticationPrincipal CustomUserDetails admin, HttpServletRequest request) {
        return ResponseEntity.ok(usuarioService.redefinirSenha(id, admin.getUsuario(), clientIpResolver.resolve(request)));
    }

    @GetMapping("/logs")
    public ResponseEntity<Page<LogSistemaResponse>> listarLogs(
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String perfil,
            @RequestParam(required = false) String acao,
            @RequestParam(required = false) String resultado,
            @RequestParam(required = false) String entidade,
            @RequestParam(required = false) String recursoId,
            @RequestParam(required = false) String sessionRef,
            @RequestParam(required = false) String requestId,
            @RequestParam(required = false) String ip,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<String> fields,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant fim,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "dataHora") String sortBy,
            @RequestParam(defaultValue = "desc") String direction) {
        int pagina = Math.max(page, 0);
        int tamanho = Math.min(Math.max(size, 1), 100);
        if (!List.of("acao", "entidade", "dataHora", "id").contains(sortBy)
                || Sort.Direction.fromOptionalString(direction).isEmpty()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Ordenação inválida");
        }
        String campoOrdenacao = sortBy;
        Sort.Direction direcao = Sort.Direction.fromString(direction);
        Sort ordenacao = Sort.by(new Sort.Order(direcao, campoOrdenacao));
        if (!"id".equals(campoOrdenacao)) ordenacao = ordenacao.and(Sort.by(new Sort.Order(direcao, "id")));
        var pageable = PageRequest.of(pagina, tamanho, ordenacao);
        return ResponseEntity.ok(logSistemaService.pesquisarAvancado(email, perfil, acao, resultado, entidade,
                recursoId, sessionRef, requestId, ip, search, fields, inicio, fim, pageable));
    }

    @GetMapping("/estatisticas")
    public ResponseEntity<AdminEstatisticasResponse> estatisticas(
            @RequestParam(required = false) List<Integer> usuarioIds,
            @RequestParam(required = false) List<Integer> clienteIds,
            @RequestParam(required = false) List<String> statusPedidos,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fim,
            @RequestParam(defaultValue = "0") int paginaProdutos,
            @RequestParam(defaultValue = "0") int paginaUsuarios,
            @RequestParam(defaultValue = "0") int paginaClientes,
            @RequestParam(defaultValue = "0") int paginaMovimentacoes,
            @RequestParam(defaultValue = "10") int tamanhoPagina,
            @RequestParam(defaultValue = "false") boolean refresh) {
        if (refresh && cacheManager.getCache("adminEstatisticas") != null) {
            cacheManager.getCache("adminEstatisticas").clear();
        }
        return ResponseEntity.ok(adminService.estatisticas(
                usuarioIds,
                clienteIds,
                statusPedidos,
                inicio,
                fim,
                Math.max(paginaProdutos, 0),
                Math.max(paginaUsuarios, 0),
                Math.max(paginaClientes, 0),
                Math.max(paginaMovimentacoes, 0),
                Math.min(Math.max(tamanhoPagina, 1), 100)));
    }

    @GetMapping("/configuracoes")
    public ResponseEntity<ConfiguracaoSistemaResponse> configuracoes() {
        return ResponseEntity.ok(configuracaoSistemaService.consultar());
    }

    @PutMapping("/configuracoes")
    public ResponseEntity<ConfiguracaoSistemaResponse> atualizarConfiguracoes(
            @Valid @RequestBody ConfiguracaoSistemaRequest request,
            @AuthenticationPrincipal CustomUserDetails admin, HttpServletRequest httpRequest) {
        return ResponseEntity.ok(configuracaoSistemaService.atualizar(request, admin.getUsuario(),
                clientIpResolver.resolve(httpRequest)));
    }

    @GetMapping("/configuracoes/diagnostico")
    public ResponseEntity<DiagnosticoSistemaService.Diagnostico> diagnostico() {
        return ResponseEntity.ok(diagnosticoSistemaService.consultar());
    }

    @GetMapping("/relatorios")
    public ResponseEntity<?> relatorios() {
        return ResponseEntity.ok(relatorioAdminService.catalogo().stream()
                .map(r -> Map.of("id", r.id(), "categoria", r.categoria(), "titulo", r.titulo(),
                        "descricao", r.descricao(), "filtros", r.filtros()))
                .toList());
    }

    @GetMapping("/relatorios/{id}/xlsx")
    public ResponseEntity<StreamingResponseBody> exportarRelatorio(
            @PathVariable String id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
            @RequestParam(required = false) Integer clienteId,
            @RequestParam(required = false) Integer produtoId,
            @RequestParam(required = false) Integer usuarioId,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal CustomUserDetails admin,
            HttpServletRequest request) {
        // Valida antes de abrir o stream para ainda permitir respostas JSON com 400 ou 404.
        var relatorio = relatorioAdminService.obter(id);
        var filtros = new RelatorioAdminService.Filtros(inicio, fim, clienteId, produtoId, usuarioId, status);
        // Congela o conjunto de logs antes do primeiro evento desta exportação.
        Long corte = relatorio.from().contains("agerp.log_sistema l") ? relatorioAdminService.corteAuditoria() : null;
        var ator = admin == null ? null : admin.getUsuario();
        var contexto = new ExportacaoAuditoriaService.Contexto(UUID.randomUUID(), AuditRequestContext.current(),
                ator == null ? null : ator.getId(), ator == null ? null : ator.getNome(),
                ator == null ? null : ator.getEmail(),
                ator == null || ator.getIdPerfil() == null ? null : ator.getIdPerfil().getNome(),
                referencia(request.getAttribute("agerp.session.id")),
                referencia(request.getAttribute("agerp.device.id")), relatorio.id(),
                ExportacaoAuditoriaService.filtrosSeguros(filtros));
        // Se o executor MVC estiver cheio, responde em JSON antes de comprometer os cabeçalhos XLSX.
        // O semáforo limita separadamente o tempo de vida do spool em downloads lentos.
        if (mvcExecutor != null && mvcExecutor.getActiveCount() >= mvcExecutor.getMaxPoolSize()
                && mvcExecutor.getThreadPoolExecutor().getQueue().remainingCapacity() == 0) {
            exportacaoAuditoria.registrar(contexto, "EXPORTACAO_FALHA", "NEGADO", null, null,
                    0, "EXECUTOR_SATURADO");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Servidor ocupado com exportações. Tente novamente em instantes.");
        }
        if (!exportacoes.tryAcquire())
        {
            exportacaoAuditoria.registrar(contexto, "EXPORTACAO_FALHA", "NEGADO", null, null,
                    0, "LIMITE_CONCORRENCIA");
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Limite de exportações simultâneas. Tente novamente.");
        }
        long inicioNs = System.nanoTime();
        Path temporario = null;
        int registros;
        long bytes;
        try {
            exportacaoAuditoria.registrar(contexto, "EXPORTACAO_SOLICITADA", "INICIADO", null, null, 0, null);
            temporario = exportacaoTemporarios.criar(contexto.exportId());
            // Uma resposta de erro de SQL/POI ainda pode ser enviada como JSON antes dos headers.
            try (var saida = Files.newOutputStream(temporario)) {
                registros = relatorioAdminService.exportarComContagem(relatorio, filtros, saida, corte);
            }
            verificarZipXlsx(temporario);
            bytes = Files.size(temporario);
            exportacaoAuditoria.registrar(contexto, "EXPORTACAO_GERADA", "SUCESSO", registros,
                    bytes, duracao(inicioNs), null);
        } catch (IOException | RuntimeException falha) {
            if (temporario != null) exportacaoTemporarios.apagar(temporario);
            try {
                exportacaoAuditoria.registrar(contexto, "EXPORTACAO_FALHA", "FALHA", null,
                        null, duracao(inicioNs), "GERACAO");
            } catch (RuntimeException auditoriaFalhou) {
                LOGGER.error("Auditoria da falha de geração indisponível exportId={}", contexto.exportId(), auditoriaFalhou);
            }
            LOGGER.error("Falha antes dos headers, exportId={}", contexto.exportId(), falha);
            exportacoes.release();
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Não foi possível gerar o relatório. Referência: " + contexto.exportId());
        }
        String nome = "agerp_" + relatorio.id() + "_" + LocalDate.now() + ".xlsx";
        Path arquivo = temporario;
        ExportacaoFluxo fluxo = new ExportacaoFluxo(exportacaoTemporarios, exportacaoAuditoria,
                contexto, arquivo, exportacoes, registros, bytes, inicioNs);
        Object barrier = request.getAttribute(ExportacaoAsyncCleanupFilter.BARRIER);
        if (barrier instanceof CountDownLatch latch) fluxo.aguardarFiltros(latch);
        request.setAttribute(ExportacaoAsyncCleanupFilter.ATTR, fluxo);
        StreamingResponseBody body = output -> {
            fluxo.iniciarTransmissao();
            try {
                fluxo.aguardarCabecalhos();
                try (var entrada = Files.newInputStream(arquivo)) {
                entrada.transferTo(output);
                output.flush();
                fluxo.sucesso();
                }
            } catch (IOException | RuntimeException falha) {
                LOGGER.warn("Transmissão interrompida/indeterminada, exportId={} classe={}",
                        contexto.exportId(), falha.getClass().getSimpleName(), falha);
                fluxo.falha("TRANSMISSAO_OU_CONEXAO");
                throw falha;
                // O HTTP já pode ter sido comprometido: não tentar anexar JSON ao ZIP.
            }
        };
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nome + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store, private")
                .header("X-Export-ID", contexto.exportId().toString())
                .contentLength(bytes)
                .body(body);
    }

    private static void verificarZipXlsx(Path arquivo) throws IOException {
        // ZIP com entradas integralmente lidas verifica CRC; PK inicial isolado não basta.
        boolean contentTypes = false;
        boolean workbook = false;
        try (ZipFile zip = new ZipFile(arquivo.toFile())) {
            byte[] buffer = new byte[64 * 1024];
            var entradas = zip.entries();
            while (entradas.hasMoreElements()) {
                ZipEntry entrada = entradas.nextElement();
                if ("[Content_Types].xml".equals(entrada.getName())) contentTypes = true;
                if ("xl/workbook.xml".equals(entrada.getName())) workbook = true;
                CRC32 crc = new CRC32();
                long lidos = 0;
                try (var conteudo = zip.getInputStream(entrada)) {
                    int n;
                    while ((n = conteudo.read(buffer)) != -1) {
                        crc.update(buffer, 0, n);
                        lidos += n;
                    }
                }
                if (entrada.getSize() != lidos || entrada.getCrc() != crc.getValue()) {
                    throw new IOException("CRC ou tamanho ZIP invalido: " + entrada.getName());
                }
            }
        }
        if (!contentTypes || !workbook) throw new IOException("Estrutura OOXML incompleta");
    }

    private static String referencia(Object referencia) {
        return referencia == null ? null : referencia.toString().substring(0, Math.min(100, referencia.toString().length()));
    }

    private static long duracao(long inicioNs) {
        return java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - inicioNs);
    }

}
