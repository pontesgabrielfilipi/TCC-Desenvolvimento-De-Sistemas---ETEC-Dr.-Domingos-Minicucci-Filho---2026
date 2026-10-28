package com.agerp.agerp.controller;

import com.agerp.agerp.dto.UsuarioCreateRequest;
import com.agerp.agerp.dto.UsuarioResponse;
import com.agerp.agerp.dto.UsuarioUpdateRequest;
import com.agerp.agerp.service.UsuarioService;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.security.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    private final UsuarioService usuarioService;
    private final ClientIpResolver clientIpResolver;

    public UsuarioController(UsuarioService usuarioService, ClientIpResolver clientIpResolver) {
        this.usuarioService = usuarioService;
        this.clientIpResolver = clientIpResolver;
    }

    @PostMapping
    public ResponseEntity<UsuarioResponse> criar(@Valid @RequestBody UsuarioCreateRequest request,
            HttpServletRequest httpRequest) {
        UsuarioResponse response = usuarioService.criar(request, clientIpResolver.resolve(httpRequest));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<UsuarioResponse>> listarTodos() {
        List<UsuarioResponse> usuarios = usuarioService.listarTodos();
        return ResponseEntity.ok(usuarios);
    }

    @GetMapping("/ativos")
    public ResponseEntity<List<UsuarioResponse>> listarAtivos() {
        List<UsuarioResponse> usuarios = usuarioService.listarAtivos();
        return ResponseEntity.ok(usuarios);
    }

    @GetMapping("/{id}")
    public ResponseEntity<UsuarioResponse> buscarPorId(@PathVariable Integer id) {
        UsuarioResponse usuario = usuarioService.buscarPorId(id);
        return ResponseEntity.ok(usuario);
    }

    @GetMapping("/email/{email}")
    public ResponseEntity<UsuarioResponse> buscarPorEmail(@PathVariable String email) {
        UsuarioResponse usuario = usuarioService.buscarPorEmail(email);
        return ResponseEntity.ok(usuario);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@PathVariable Integer id,
            @AuthenticationPrincipal CustomUserDetails admin, HttpServletRequest request) {
        usuarioService.excluirLogicamente(id, admin.getUsuario(), clientIpResolver.resolve(request));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/permanente")
    public ResponseEntity<Void> deletarPermanente(@PathVariable Integer id) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).build();
    }
}
