package com.agerp.agerp.controller;

import com.agerp.agerp.dto.LogSistemaResponse;
import com.agerp.agerp.dto.UsuarioResponse;
import com.agerp.agerp.entity.LogSistema;
import com.agerp.agerp.service.LogSistemaService;
import com.agerp.agerp.service.UsuarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")   // ← Mudança importante aqui
public class AdminController {

    private final UsuarioService usuarioService;
    private final LogSistemaService logSistemaService;

    @GetMapping("/usuarios")
    public ResponseEntity<List<UsuarioResponse>> listarUsuarios() {
        return ResponseEntity.ok(usuarioService.listarTodos());
    }

    @GetMapping("/usuarios/ativos")
    public ResponseEntity<List<UsuarioResponse>> listarUsuariosAtivos() {
        return ResponseEntity.ok(usuarioService.listarAtivos());
    }

    @GetMapping("/logs")
    public ResponseEntity<List<LogSistemaResponse>> listarLogs() {
        return ResponseEntity.ok(logSistemaService.listarTodos());
    }

    @GetMapping("/estatisticas")
    public ResponseEntity<Map<String, Object>> estatisticas() {
        return ResponseEntity.ok(Map.of(
                "totalUsuarios", usuarioService.countTotalUsuarios(),
                "usuariosAtivos", usuarioService.countUsuariosAtivos()
        ));
    }

    @GetMapping("/configuracoes")
    public ResponseEntity<Map<String, Object>> configuracoes() {
        return ResponseEntity.ok(Map.of(
                "versao", "1.0.0",
                "ambiente", "Desenvolvimento"
        ));
    }

    @GetMapping("/relatorios")
    public ResponseEntity<String> relatorios() {
        return ResponseEntity.ok("Relatórios em desenvolvimento");
    }
}