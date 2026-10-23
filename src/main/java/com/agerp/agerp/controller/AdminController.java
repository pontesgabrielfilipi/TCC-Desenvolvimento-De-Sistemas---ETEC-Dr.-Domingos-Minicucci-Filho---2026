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

import java.util.List;
import java.util.Map;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")   // ← Mudança importante aqui
public class AdminController {

    private final AdminService adminService;
    private final UsuarioService usuarioService;
    private final LogSistemaService logSistemaService;
    private final PerfilService perfilService;
    private final ClientIpResolver clientIpResolver;
    private final ConfiguracaoSistemaService configuracaoSistemaService;
    private final DiagnosticoSistemaService diagnosticoSistemaService;
    private final CacheManager cacheManager;
    private final RelatorioAdminService relatorioAdminService;

    public AdminController(AdminService adminService, UsuarioService usuarioService,
            LogSistemaService logSistemaService, PerfilService perfilService,
            ClientIpResolver clientIpResolver, ConfiguracaoSistemaService configuracaoSistemaService,
            DiagnosticoSistemaService diagnosticoSistemaService, CacheManager cacheManager,
            RelatorioAdminService relatorioAdminService) {
        this.adminService = adminService;
        this.usuarioService = usuarioService;
        this.logSistemaService = logSistemaService;
        this.perfilService = perfilService;
        this.clientIpResolver = clientIpResolver;
        this.configuracaoSistemaService = configuracaoSistemaService;
        this.diagnosticoSistemaService = diagnosticoSistemaService;
        this.cacheManager = cacheManager;
        this.relatorioAdminService = relatorioAdminService;
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
        String campoOrdenacao = switch (sortBy) {
            case "acao", "entidade", "dataHora", "id" -> sortBy;
            default -> "dataHora";
        };
        Sort.Direction direcao = Sort.Direction.fromOptionalString(direction).orElse(Sort.Direction.DESC);
        Sort ordenacao = Sort.by(new Sort.Order(direcao, campoOrdenacao));
        if (!"id".equals(campoOrdenacao)) ordenacao = ordenacao.and(Sort.by(new Sort.Order(direcao, "id")));
        var pageable = PageRequest.of(pagina, tamanho, ordenacao);
        return ResponseEntity.ok(search != null
                ? logSistemaService.pesquisarGeral(search, fields, inicio, fim, pageable)
                : logSistemaService.pesquisar(email, perfil, acao, inicio, fim, pageable));
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
            @RequestParam(required = false) String status) {
        // Validacao antecipada: 400/404 antes de abrir o stream HTTP.
        var relatorio = relatorioAdminService.obter(id);
        var filtros = new RelatorioAdminService.Filtros(inicio, fim, clienteId, produtoId, usuarioId, status);
        String nome = "agerp_" + relatorio.id() + "_" + LocalDate.now() + ".xlsx";
        StreamingResponseBody body = output -> relatorioAdminService.exportar(relatorio, filtros, output);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nome + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store, private")
                .body(body);
    }
}
