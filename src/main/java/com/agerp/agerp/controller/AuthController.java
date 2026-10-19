package com.agerp.agerp.controller;

import com.agerp.agerp.dto.LoginRequest;
import com.agerp.agerp.dto.UsuarioResponse;
import com.agerp.agerp.dto.AlteracaoSenhaObrigatoriaRequest;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.security.ClientIpResolver;
import com.agerp.agerp.security.jwt.JwtProperties;
import com.agerp.agerp.security.jwt.JwtTokenProvider;
import com.agerp.agerp.service.LogSistemaService;
import com.agerp.agerp.service.UsuarioService;
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

    @Autowired
    public AuthController(AuthenticationManager authenticationManager, JwtTokenProvider jwtTokenProvider,
            LogSistemaService logSistemaService, UsuarioService usuarioService,
            ClientIpResolver clientIpResolver, JwtProperties jwtProperties) {
        this.authenticationManager = authenticationManager;
        this.jwtTokenProvider = jwtTokenProvider;
        this.logSistemaService = logSistemaService;
        this.usuarioService = usuarioService;
        this.clientIpResolver = clientIpResolver;
        this.jwtProperties = jwtProperties;
    }

    // Mantém compatibilidade com integrações que instanciam o controller diretamente.
    AuthController(AuthenticationManager authenticationManager, JwtTokenProvider jwtTokenProvider,
            LogSistemaService logSistemaService, UsuarioService usuarioService) {
        this(authenticationManager, jwtTokenProvider, logSistemaService, usuarioService,
                new ClientIpResolver(""), new JwtProperties());
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest loginRequest,
                                   HttpServletRequest request,      // ← Adicionado
                                   HttpServletResponse response) {

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            loginRequest.getEmail(),
                            loginRequest.getSenha()
                    )
            );

            CustomUserDetails authenticatedUser = (CustomUserDetails) authentication.getPrincipal();
            StatusAcesso status = authenticatedUser.getUsuario().getStatusAcesso();
            if (status != StatusAcesso.APROVADO) {
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

            String jwtToken = jwtTokenProvider.generateToken(authentication);

            // Cookie JWT
            response.addCookie(jwtCookie(jwtToken, jwtMaxAgeSeconds()));

            // ====================== REGISTRO DE LOG COM IP REAL ======================
            CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
            Usuario usuarioLogado = userDetails.getUsuario();

            String ipReal = clientIpResolver.resolve(request);

            logSistemaService.registrarLog(
                    usuarioLogado,
                    "LOGIN",
                    "USUARIO",
                    ipReal
            );
            // =====================================================================

            return ResponseEntity.ok(Map.of(
                    "message", "Login realizado com sucesso",
                    "trocaSenhaObrigatoria", Boolean.TRUE.equals(authenticatedUser.getUsuario().getTrocaSenhaObrigatoria())));

        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", "TEMPORARY_CREDENTIAL_INVALID", "message", e.getMessage()));
        } catch (AuthenticationException e) {
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

        return ResponseEntity.ok(responseDTO);
    }

    @PostMapping("/alterar-senha-obrigatoria")
    public ResponseEntity<?> alterarSenhaObrigatoria(@Valid @RequestBody AlteracaoSenhaObrigatoriaRequest body,
            @AuthenticationPrincipal CustomUserDetails user, HttpServletRequest request,
            HttpServletResponse response) {
        usuarioService.alterarSenhaObrigatoria(user.getUsuario().getId(), body.getSenha(),
                body.getConfirmacaoSenha(), clientIpResolver.resolve(request));
        response.addCookie(jwtCookie(null, 0));
        return ResponseEntity.ok(Map.of("message", "Senha alterada com sucesso. Faça login novamente."));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        response.addCookie(jwtCookie(null, 0));

        return ResponseEntity.ok(Map.of("message", "Logout realizado com sucesso"));
    }

    private Cookie jwtCookie(String value, int maxAgeSeconds) {
        Cookie cookie = new Cookie("jwtToken", value);
        cookie.setHttpOnly(true);
        cookie.setSecure(jwtProperties.isCookieSecure());
        cookie.setPath("/");
        cookie.setMaxAge(maxAgeSeconds);
        cookie.setAttribute("SameSite", "Strict");
        return cookie;
    }

    private int jwtMaxAgeSeconds() {
        long seconds = Math.ceilDiv(jwtProperties.getExpiration(), 1_000L);
        return (int) Math.min(seconds, Integer.MAX_VALUE);
    }
}
