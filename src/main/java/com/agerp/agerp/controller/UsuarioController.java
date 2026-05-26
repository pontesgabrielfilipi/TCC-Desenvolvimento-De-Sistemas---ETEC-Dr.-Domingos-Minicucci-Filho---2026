package com.agerp.agerp.controller;

import com.agerp.agerp.dto.UsuarioCreateRequest;
import com.agerp.agerp.dto.UsuarioResponse;
import com.agerp.agerp.dto.UsuarioUpdateRequest;
import com.agerp.agerp.service.UsuarioService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService usuarioService;

    // ====================== CRIAR USUÁRIO ======================
    @PostMapping
    public ResponseEntity<UsuarioResponse> criar(@Valid @RequestBody UsuarioCreateRequest request) {
        UsuarioResponse response = usuarioService.criar(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ====================== LISTAR TODOS ======================
    @GetMapping
    public ResponseEntity<List<UsuarioResponse>> listarTodos() {
        List<UsuarioResponse> usuarios = usuarioService.listarTodos();
        return ResponseEntity.ok(usuarios);
    }

    // ====================== LISTAR APENAS ATIVOS ======================
    @GetMapping("/ativos")
    public ResponseEntity<List<UsuarioResponse>> listarAtivos() {
        List<UsuarioResponse> usuarios = usuarioService.listarAtivos();
        return ResponseEntity.ok(usuarios);
    }

    // ====================== BUSCAR POR ID ======================
    @GetMapping("/{id}")
    public ResponseEntity<UsuarioResponse> buscarPorId(@PathVariable Integer id) {
        UsuarioResponse usuario = usuarioService.buscarPorId(id);
        return ResponseEntity.ok(usuario);
    }

    // ====================== BUSCAR POR EMAIL ======================
    @GetMapping("/email/{email}")
    public ResponseEntity<UsuarioResponse> buscarPorEmail(@PathVariable String email) {
        UsuarioResponse usuario = usuarioService.buscarPorEmail(email);
        return ResponseEntity.ok(usuario);
    }

    // ====================== ATUALIZAR USUÁRIO ======================
    @PutMapping("/{id}")
    public ResponseEntity<UsuarioResponse> atualizar(
            @PathVariable Integer id,
            @Valid @RequestBody UsuarioUpdateRequest request) {

        UsuarioResponse response = usuarioService.atualizar(id, request);
        return ResponseEntity.ok(response);
    }

    // ====================== SOFT DELETE (RECOMENDADO) ======================
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@PathVariable Integer id) {
        usuarioService.deletar(id);
        return ResponseEntity.noContent().build();
    }

    // ====================== HARD DELETE (opcional - cuidado!) ======================
    @DeleteMapping("/{id}/permanente")
    public ResponseEntity<Void> deletarPermanente(@PathVariable Integer id) {
        usuarioService.deletarPermanente(id);
        return ResponseEntity.noContent().build();
    }
}