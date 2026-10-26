package com.agerp.agerp.security.jwt;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.service.SessaoAutenticacaoService;
import com.agerp.agerp.service.AuditFailureService;
import com.agerp.agerp.security.LoginAttemptLimiter;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsService userDetailsService;
    private final SessaoAutenticacaoService sessoes;
    private final AuditFailureService failures;
    private final LoginAttemptLimiter limiter;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider, UserDetailsService userDetailsService,
                                   SessaoAutenticacaoService sessoes, AuditFailureService failures,
                                   LoginAttemptLimiter limiter) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.userDetailsService = userDetailsService;
        this.sessoes = sessoes;
        this.failures = failures;
        this.limiter = limiter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // não executa validação de token nas rotas de autenticação
        String requestURI = request.getRequestURI();
        if (requestURI.contains("/auth/login")) {

            filterChain.doFilter(request, response);
            return;
        }

        String jwt = getJwtFromCookie(request);
        if (StringUtils.hasText(jwt) && !jwtTokenProvider.validateToken(jwt))
            auditTokenFailure(request, jwtTokenProvider.tokenFailureKind(jwt));

        if (StringUtils.hasText(jwt) && jwtTokenProvider.validateToken(jwt)) {
            try {
                String email = jwtTokenProvider.getEmailFromToken(jwt);

                UserDetails userDetails = userDetailsService.loadUserByUsername(email);

                if (!(userDetails instanceof CustomUserDetails custom)
                        || custom.getUsuario().getStatusAcesso() != StatusAcesso.APROVADO
                        || !custom.getUsuario().isAtivo()
                        || !sessoes.valida(jwtTokenProvider.getSessionId(jwt), custom.getUsuario().getId())
                        || custom.getUsuario().getCredentialVersion() == null
                        || custom.getUsuario().getCredentialVersion() != jwtTokenProvider.getCredentialVersion(jwt)
                        || (Boolean.TRUE.equals(custom.getUsuario().getTrocaSenhaObrigatoria())
                            && !isPasswordChangeEndpoint(requestURI))) {
                    SecurityContextHolder.clearContext();
                    auditTokenFailure(request, "ACESSO_NEGADO");
                    filterChain.doFilter(request, response);
                    return;
                }

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());

                SecurityContextHolder.getContext().setAuthentication(authentication);
                request.setAttribute("agerp.session.id", jwtTokenProvider.getSessionId(jwt));
                request.setAttribute("agerp.device.id", sessoes.dispositivo(jwtTokenProvider.getSessionId(jwt)));

            } catch (Exception e) {
                // Token inválido ou usuário não encontrado → limpa o contexto
                SecurityContextHolder.clearContext();
                auditTokenFailure(request, "ACESSO_NEGADO");
            }
        }

        filterChain.doFilter(request, response);
    }

    private void auditTokenFailure(HttpServletRequest request, String kind) {
        String ip = request.getRemoteAddr();
        if (!limiter.blocked("jwt-failure", ip)) {
            limiter.fail("jwt-failure", ip);
            failures.registrarFalha(kind, "AUTENTICACAO", "NEGADO");
        }
    }

    private boolean isPasswordChangeEndpoint(String uri) {
        return uri.equals("/api/auth/alterar-senha-obrigatoria")
                || uri.equals("/api/auth/me") || uri.equals("/api/auth/logout");
    }

    /**
     * Lê o token do cookie HttpOnly chamado "jwtToken"
     */
    private String getJwtFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("jwtToken".equals(cookie.getName())) {   // mantenha o nome que você está usando
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
