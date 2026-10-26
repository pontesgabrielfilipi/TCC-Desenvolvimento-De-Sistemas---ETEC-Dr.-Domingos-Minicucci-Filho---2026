package com.agerp.agerp.config;

import com.agerp.agerp.security.CustomUserDetailsService;
import com.agerp.agerp.security.jwt.JwtAuthenticationFilter;
import com.agerp.agerp.security.jwt.JwtProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.HttpMethod;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import jakarta.servlet.DispatcherType;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import org.springframework.beans.factory.annotation.Value;
import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final CustomUserDetailsService customUserDetailsService;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JwtProperties jwtProperties;
    private final String corsOrigins;

    public SecurityConfig(CustomUserDetailsService customUserDetailsService,
            JwtAuthenticationFilter jwtAuthenticationFilter, JwtProperties jwtProperties,
            @Value("${agerp.security.cors-origins:http://localhost:5173,http://127.0.0.1:5173}") String corsOrigins) {
        this.customUserDetailsService = customUserDetailsService;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.jwtProperties = jwtProperties;
        this.corsOrigins = corsOrigins;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // Em HTTP local, o CSRF segue a politica configurada; em HTTPS
        // validado pelo proxy confiavel, ambos os cookies usam Secure.
        var httpCsrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
        httpCsrf.setCookieCustomizer(cookie -> cookie.sameSite(jwtProperties.getCookieSameSite())
                .secure(jwtProperties.isCookieSecure()));
        var httpsCsrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
        httpsCsrf.setCookieCustomizer(cookie -> cookie.sameSite(jwtProperties.getCookieSameSite())
                .secure(true));
        CsrfTokenRepository csrfRepository = new CsrfTokenRepository() {
            private CsrfTokenRepository select(jakarta.servlet.http.HttpServletRequest request) {
                return jwtProperties.isCookieSecure() || request.isSecure() ? httpsCsrf : httpCsrf;
            }

            @Override
            public CsrfToken generateToken(jakarta.servlet.http.HttpServletRequest request) {
                return select(request).generateToken(request);
            }

            @Override
            public void saveToken(CsrfToken token, jakarta.servlet.http.HttpServletRequest request,
                    jakarta.servlet.http.HttpServletResponse response) {
                select(request).saveToken(token, request, response);
            }

            @Override
            public CsrfToken loadToken(jakarta.servlet.http.HttpServletRequest request) {
                return select(request).loadToken(request);
            }
        };
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfRepository)
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                .authorizeHttpRequests(auth -> auth
                        // Internal ASYNC/ERROR redispatches cannot originate from external clients.
                        // ADMIN authorization still applies to the original HTTP REQUEST.
                        .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
                        // Endpoints totalmente públicos
                        .requestMatchers(
                                "/api/auth/login",
                                "/api/auth/logout",
                                "/api/auth/me",
                                "/api/auth/csrf",
                                "/actuator/health",
                                "/actuator/health/**"
                        ).permitAll()
                        .requestMatchers("/api/auth/sessions", "/api/auth/sessions/**").authenticated()
                        .requestMatchers("/api/auth/admin/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/usuarios").permitAll()

                        // Apenas ADMIN pode acessar qualquer coisa em /api/admin
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/usuarios/**", "/api/usuarios").hasRole("ADMIN")

                        // Validação no servidor para cada funcionalidade, incluindo URLs diretas.
                        .requestMatchers("/api/dashboard", "/api/dashboard/**").hasAuthority("PAGE_DASHBOARD")
                        .requestMatchers("/api/clientes", "/api/clientes/**").hasAuthority("PAGE_CLIENTES")
                        .requestMatchers("/api/produtos", "/api/produtos/**").hasAuthority("PAGE_PRODUTOS")
                        .requestMatchers("/api/pedidos", "/api/pedidos/**").hasAuthority("PAGE_PEDIDOS")

                        // Todo o resto da API exige autenticação
                        .requestMatchers("/api/**").authenticated()

                        .anyRequest().authenticated()
                )

                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(customUserDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        var origins = Arrays.stream(corsOrigins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        for (String origin : origins) {
            if (!origin.matches("https?://[a-zA-Z0-9.\\-]+(:[0-9]{1,5})?"))
                throw new IllegalArgumentException("Invalid explicit CORS origin: " + origin);
        }
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(java.util.List.of("Content-Type", "X-XSRF-TOKEN", "Accept"));
        config.setExposedHeaders(java.util.List.of("X-Export-ID", "X-Request-ID"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
