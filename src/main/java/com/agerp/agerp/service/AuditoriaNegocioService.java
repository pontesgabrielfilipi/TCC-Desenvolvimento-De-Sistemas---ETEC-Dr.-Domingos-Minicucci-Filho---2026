package com.agerp.agerp.service;

import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.security.CustomUserDetails;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/** Auditoria de negócio transacional. Apenas campos permitidos são entregues ao log. */
@Service
public class AuditoriaNegocioService {
    private final LogSistemaService logs;

    public AuditoriaNegocioService(LogSistemaService logs) { this.logs = logs; }

    public void registrar(String acao, String entidade, Integer recurso, Map<String, ?> diferencas) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof CustomUserDetails details))
            throw new org.springframework.security.access.AccessDeniedException("Ator autenticado necessário para auditoria de negócio");
        Usuario ator = details.getUsuario();
        logs.registrarEvento(ator, acao, entidade, String.valueOf(recurso), "SUCESSO", null, null, diferencas);
    }

    public static Map<String, Object> mudancas(Object... pares) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < pares.length; i += 3) {
            String campo = (String) pares[i];
            Object antes = normalizar(pares[i + 1]);
            Object depois = normalizar(pares[i + 2]);
            if (!Objects.equals(antes, depois)) {
                Map<String, Object> diff = new LinkedHashMap<>();
                diff.put("antes", antes);
                diff.put("depois", depois);
                result.put(campo, diff);
            }
        }
        return result;
    }

    private static Object normalizar(Object valor) {
        if (valor instanceof BigDecimal decimal) return decimal.stripTrailingZeros().toPlainString();
        if (valor instanceof Enum<?> enumerado) return enumerado.name();
        return valor;
    }
}
