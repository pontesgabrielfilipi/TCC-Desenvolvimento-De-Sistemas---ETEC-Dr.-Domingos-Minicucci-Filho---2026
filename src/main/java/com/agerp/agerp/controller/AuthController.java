package com.agerp.agerp.controller;

import com.agerp.agerp.dto.LoginRequest;
import com.agerp.agerp.dto.UsuarioResponse;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.security.jwt.JwtTokenProvider;
import com.agerp.agerp.service.LogSistemaService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final LogSistemaService logSistemaService;

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

            String jwtToken = jwtTokenProvider.generateToken(authentication);

            // Cookie JWT
            Cookie cookie = new Cookie("jwtToken", jwtToken);
            cookie.setHttpOnly(true);
            cookie.setSecure(false);           // ← mude para true em produção (HTTPS)
            cookie.setPath("/");
            cookie.setMaxAge(24 * 60 * 60);

            response.addCookie(cookie);

            // ====================== REGISTRO DE LOG COM IP REAL ======================
            CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
            Usuario usuarioLogado = userDetails.getUsuario();

            String ipReal = getClientIpAddress(request);

            logSistemaService.registrarLog(
                    usuarioLogado,
                    "LOGIN",
                    "USUARIO",
                    ipReal
            );
            // =====================================================================

            return ResponseEntity.ok(Map.of("message", "Login realizado com sucesso"));

        } catch (AuthenticationException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Email ou senha inválidos"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Erro interno no servidor"));
        }
    }

    /**
     * Método robusto para pegar o IP real do usuário mesmo atrás de proxy/Cloudflare/Docker
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String[] headers = {
                "X-Forwarded-For",
                "X-Real-IP",
                "CF-Connecting-IP",      // Cloudflare
                "Proxy-Client-IP",
                "WL-Proxy-Client-IP",
                "HTTP_X_FORWARDED_FOR",
                "HTTP_X_FORWARDED",
                "HTTP_X_CLUSTER_CLIENT_IP",
                "HTTP_CLIENT_IP",
                "HTTP_FORWARDED_FOR",
                "HTTP_FORWARDED",
                "HTTP_VIA",
                "REMOTE_ADDR"
        };

        for (String header : headers) {
            String ip = request.getHeader(header);
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                // Pega o primeiro IP caso venha múltiplos (ex: "192.168.1.1, 10.0.0.1")
                return ip.split(",")[0].trim();
            }
        }

        // Último fallback
        return request.getRemoteAddr();
    }

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

        return ResponseEntity.ok(responseDTO);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("jwtToken", null);
        cookie.setHttpOnly(true);
        cookie.setSecure(false);
        cookie.setPath("/");
        cookie.setMaxAge(0);

        response.addCookie(cookie);

        return ResponseEntity.ok(Map.of("message", "Logout realizado com sucesso"));
    }
}