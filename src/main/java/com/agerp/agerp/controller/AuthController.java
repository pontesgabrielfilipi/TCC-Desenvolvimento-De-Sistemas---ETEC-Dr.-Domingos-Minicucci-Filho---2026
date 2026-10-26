package com.agerp.agerp.controller;

import com.agerp.agerp.dto.LoginRequest;
import com.agerp.agerp.dto.UsuarioResponse;
import com.agerp.agerp.dto.AlteracaoSenhaObrigatoriaRequest;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.security.ClientIpResolver;
import com.agerp.agerp.security.LoginAttemptLimiter;
import com.agerp.agerp.service.AuditFailureService;
import com.agerp.agerp.security.jwt.JwtProperties;
import com.agerp.agerp.security.jwt.JwtTokenProvider;
import com.agerp.agerp.service.LogSistemaService;
import com.agerp.agerp.service.UsuarioService;
import com.agerp.agerp.service.SessaoAutenticacaoService;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.web.csrf.CsrfToken;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final LogSistemaService logSistemaService;
    private final UsuarioService usuarioService;
    private final ClientIpResolver clientIpResolver;
    private final JwtProperties jwtProperties;
    private final SessaoAutenticacaoService sessoes;
    private final LoginAttemptLimiter limiter;
    private final AuditFailureService auditFailures;

    @Autowired
    public AuthController(AuthenticationManager authenticationManager, JwtTokenProvider jwtTokenProvider,
            LogSistemaService logSistemaService, UsuarioService usuarioService,
            ClientIpResolver clientIpResolver, JwtProperties jwtProperties,
            SessaoAutenticacaoService sessoes, LoginAttemptLimiter limiter, AuditFailureService auditFailures) {
        this.authenticationManager = authenticationManager;
        this.jwtTokenProvider = jwtTokenProvider;
        this.logSistemaService = logSistemaService;
        this.usuarioService = usuarioService;
        this.clientIpResolver = clientIpResolver;
        this.jwtProperties = jwtProperties;
        this.sessoes = sessoes;
        this.limiter = limiter;
        this.auditFailures = auditFailures;
    }

    // Mantém compatibilidade com integrações que instanciam o controller diretamente.
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest loginRequest,
                                   HttpServletRequest request,      // ← Adicionado
                                   HttpServletResponse response) {

        String ip = clientIpResolver.resolve(request);
        if (limiter.blocked(loginRequest.getEmail(), ip)) {
            return ResponseEntity.status(429).body(Map.of("code", "LOGIN_RATE_LIMITED", "message", "Tente novamente mais tarde"));
        }
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            loginRequest.getEmail(),
                            loginRequest.getSenha()
                    )
            );

            CustomUserDetails authenticatedUser = (CustomUserDetails) authentication.getPrincipal();
            StatusAcesso status = authenticatedUser.getUsuario().getStatusAcesso();
            if (status != StatusAcesso.APROVADO || !authenticatedUser.getUsuario().isAtivo()) {
                auditFailures.registrarFalha("LOGIN_NEGADO", "USUARIO", "NEGADO");
                String code = status == StatusAcesso.PENDENTE ? "ACCOUNT_PENDING" : "ACCOUNT_BLOCKED";
                String message = status == StatusAcesso.PENDENTE
                        ? "Seu cadastro aguarda aprovação do administrador. Solicite a aprovação pelos canais oficiais da sua organização."
                        : "Esta conta está bloqueada ou foi rejeitada. Procure o administrador pelos canais oficiais da sua organização.";
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("code", code, "message", message));
            }

            if (Boolean.TRUE.equals(authenticatedUser.getUsuario().getTrocaSenhaObrigatoria())) {
                Usuario consumido = usuarioService.consumirCredencialTemporaria(authenticatedUser.getUsuario().getId());
                authenticatedUser = new CustomUserDetails(consumido, authenticatedUser.getAuthorities());
                authentication = new UsernamePasswordAuthenticationToken(
                        authenticatedUser, null, authenticatedUser.getAuthorities());
            }

            UUID device = existingDevice(request);
            boolean newDevice = device == null;
            if (newDevice) device = UUID.randomUUID();
            var sessao = sessoes.criar(authenticatedUser.getUsuario(), device, jwtProperties.getExpiration());
            request.setAttribute("agerp.session.id", sessao.getId());
            request.setAttribute("agerp.device.id", device);
            String jwtToken;
            try {
                jwtToken = jwtTokenProvider.generateToken(authentication, sessao.getId());
                if (jwtToken == null || jwtToken.isBlank()) throw new IllegalStateException("Token indisponivel");
                // Auditoria obrigatoria antes de publicar cookies.
                logSistemaService.registrarLog(authenticatedUser.getUsuario(), "LOGIN", "USUARIO", clientIpResolver.resolve(request));
            } catch (Exception e) {
                sessoes.revogar(sessao.getId(), "LOGIN_INCOMPLETO");
                throw e;
            }
            response.addCookie(jwtCookie(jwtToken, jwtMaxAgeSeconds(), request));
            if (newDevice) response.addCookie(deviceCookie(device, request));
            limiter.success(loginRequest.getEmail(), ip);


            return ResponseEntity.ok(Map.of(
                    "message", "Login realizado com sucesso",
                    "trocaSenhaObrigatoria", Boolean.TRUE.equals(authenticatedUser.getUsuario().getTrocaSenhaObrigatoria())));

        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", "LOGIN_FAILED", "message", "Nao foi possivel concluir o login"));
        } catch (AuthenticationException e) {
            limiter.fail(loginRequest.getEmail(), ip);
            auditFailures.registrarFalha("LOGIN_FALHA", "USUARIO", "FALHA");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Email ou senha inválidos"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Erro interno no servidor"));
        }
    }

    /**
     * Método robusto para pegar o IP real do usuário mesmo atrás de proxy/Cloudflare/Docker
     */
    @GetMapping("/me")
    public ResponseEntity<UsuarioResponse> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null ||
                !authentication.isAuthenticated() ||
                !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Usuario usuario = userDetails.getUsuario();

        UsuarioResponse responseDTO = new UsuarioResponse();
        responseDTO.setId(usuario.getId());
        responseDTO.setNome(usuario.getNome());
        responseDTO.setEmail(usuario.getEmail());
        responseDTO.setPerfilNome(
                usuario.getIdPerfil() != null ? usuario.getIdPerfil().getNome() : null
        );
        responseDTO.setAtivo(usuario.isAtivo());
        responseDTO.setStatusAcesso(usuario.getStatusAcesso().name());
          responseDTO.setTrocaSenhaObrigatoria(Boolean.TRUE.equals(usuario.getTrocaSenhaObrigatoria()));
          if (usuario.getIdPerfil() != null) {
              var perfil = usuario.getIdPerfil();
              responseDTO.setIdPerfil(perfil.getId());
              responseDTO.setNivelAutoridade(perfil.getNivelAutoridade());
              responseDTO.setPaginas("ADMIN".equalsIgnoreCase(perfil.getNome())
                      ? java.util.Set.of("ADMIN", "DASHBOARD", "CLIENTES", "PRODUTOS", "PEDIDOS")
                      : java.util.Set.copyOf(perfil.getPaginas()));
          }

        return ResponseEntity.ok(responseDTO);
    }

    @PostMapping("/alterar-senha-obrigatoria")
    public ResponseEntity<?> alterarSenhaObrigatoria(@Valid @RequestBody AlteracaoSenhaObrigatoriaRequest body,
            @AuthenticationPrincipal CustomUserDetails user, HttpServletRequest request,
            HttpServletResponse response) {
        usuarioService.alterarSenhaObrigatoria(user.getUsuario().getId(), body.getSenha(),
                body.getConfirmacaoSenha(), clientIpResolver.resolve(request));
        response.addCookie(jwtCookie(null, 0, request));
        return ResponseEntity.ok(Map.of("message", "Senha alterada com sucesso. Faça login novamente."));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        String token = tokenCookie(request);
        if (token != null && jwtTokenProvider.validateToken(token)) {
            UUID sid = jwtTokenProvider.getSessionId(token);
            Authentication current = SecurityContextHolder.getContext().getAuthentication();
            if (sid != null && current != null && current.getPrincipal() instanceof CustomUserDetails user
                    && sessoes.valida(sid, user.getUsuario().getId())) {
                sessoes.revogar(sid, "LOGOUT");
                request.setAttribute("agerp.session.id", sid);
                logSistemaService.registrarLog(user.getUsuario(), "LOGOUT", "SESSAO", sid.toString(),
                        "SUCESSO", null, clientIpResolver.resolve(request));
            }
        }
        response.addCookie(jwtCookie(null, 0, request));

        return ResponseEntity.ok(Map.of("message", "Logout realizado com sucesso"));
    }

    @GetMapping("/csrf")
    public ResponseEntity<?> csrf(@RequestAttribute(name = "org.springframework.security.web.csrf.CsrfToken") CsrfToken token) {
        return ResponseEntity.ok(Map.of("headerName", token.getHeaderName(), "token", token.getToken()));
    }

    private Cookie jwtCookie(String value, int maxAgeSeconds, HttpServletRequest request) {
        Cookie cookie = new Cookie("jwtToken", value);
        cookie.setHttpOnly(true);
        cookie.setSecure(jwtProperties.isCookieSecure() || request.isSecure());
        cookie.setPath("/");
        cookie.setMaxAge(maxAgeSeconds);
        if (!jwtProperties.getCookieDomain().isBlank()) cookie.setDomain(jwtProperties.getCookieDomain());
        cookie.setAttribute("SameSite", jwtProperties.getCookieSameSite());
        return cookie;
    }

    private String tokenCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie c : request.getCookies()) if ("jwtToken".equals(c.getName())) return c.getValue();
        return null;
    }

    private UUID existingDevice(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie c : request.getCookies()) {
            if ("agerpDevice".equals(c.getName())) {
                try { return UUID.fromString(c.getValue()); }
                catch (IllegalArgumentException ignored) { return null; }
            }
        }
        return null;
    }

    private Cookie deviceCookie(UUID device, HttpServletRequest request) {
        // Dedicated logical browser ID. No hardware identifiers.
        Cookie result = new Cookie("agerpDevice", device.toString());
        result.setHttpOnly(true);
        result.setSecure(jwtProperties.isCookieSecure() || request.isSecure());
        result.setPath("/");
        result.setMaxAge((int) Math.min((long) jwtProperties.getDeviceCookieDays() * 86400L, Integer.MAX_VALUE));
        if (!jwtProperties.getCookieDomain().isBlank()) result.setDomain(jwtProperties.getCookieDomain());
        result.setAttribute("SameSite", jwtProperties.getCookieSameSite());
        return result;
    }

    @GetMapping("/sessions")
    public ResponseEntity<?> sessions(@AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(sessoes.listar(user.getUsuario().getId()).stream().map(s -> Map.of(
                "id", s.getId().toString(), "createdAt", s.getCriadaEm().toString(),
                "expiresAt", s.getExpiraEm().toString(),
                "active", s.getRevogadaEm() == null && s.getExpiraEm().isAfter(java.time.Instant.now()))).toList());
    }

    @GetMapping("/admin/users/{userId}/sessions")
    public ResponseEntity<?> adminSessions(@PathVariable Integer userId,
            @AuthenticationPrincipal CustomUserDetails admin) {
        if (!"ADMIN".equalsIgnoreCase(admin.getUsuario().getIdPerfil().getNome()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        return ResponseEntity.ok(sessoes.listar(userId).stream().map(s -> Map.of(
                "id", s.getId().toString(), "createdAt", s.getCriadaEm().toString(),
                "expiresAt", s.getExpiraEm().toString(),
                "active", s.getRevogadaEm() == null && s.getExpiraEm().isAfter(java.time.Instant.now()))).toList());
    }

    @DeleteMapping("/admin/users/{userId}/sessions/{id}")
    public ResponseEntity<?> adminRevokeSession(@PathVariable Integer userId, @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails admin, HttpServletRequest request) {
        if (!"ADMIN".equalsIgnoreCase(admin.getUsuario().getIdPerfil().getNome()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        if (!sessoes.revogarDoUsuario(id, userId, "REVOGACAO_ADMIN")) return ResponseEntity.notFound().build();
        logSistemaService.registrarLog(admin.getUsuario(), "REVOGACAO_SESSAO", "SESSAO",
                id.toString(), "SUCESSO", null, clientIpResolver.resolve(request));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<?> revokeSession(@PathVariable UUID id, @AuthenticationPrincipal CustomUserDetails user,
            HttpServletRequest request) {
        if (!sessoes.revogarDoUsuario(id, user.getUsuario().getId(), "REVOGACAO_MANUAL"))
            return ResponseEntity.notFound().build();
        logSistemaService.registrarLog(user.getUsuario(), "REVOGACAO_SESSAO", "SESSAO",
                id.toString(), "SUCESSO", null, clientIpResolver.resolve(request));
        return ResponseEntity.noContent().build();
    }

    private int jwtMaxAgeSeconds() {
        long seconds = Math.ceilDiv(jwtProperties.getExpiration(), 1_000L);
        return (int) Math.min(seconds, Integer.MAX_VALUE);
    }
}
