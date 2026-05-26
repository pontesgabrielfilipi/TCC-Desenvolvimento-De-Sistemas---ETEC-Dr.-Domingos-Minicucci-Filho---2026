package com.agerp.agerp.controller;

import com.agerp.agerp.dto.ProdutoCreateRequest;
import com.agerp.agerp.dto.ProdutoResponse;
import com.agerp.agerp.dto.ProdutoUpdateRequest;
import com.agerp.agerp.service.ProdutoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/produtos")
@RequiredArgsConstructor
public class ProdutoController {

    private final ProdutoService produtoService;

    /** Lista apenas ativos (padrão da aplicação) */
    @GetMapping
    public ResponseEntity<List<ProdutoResponse>> listarAtivos() {
        return ResponseEntity.ok(produtoService.listarAtivos());
    }

    /** Lista TODOS os produtos (ativos + inativos) */
    @GetMapping("/todos")
    public ResponseEntity<List<ProdutoResponse>> listarTodos() {
        return ResponseEntity.ok(produtoService.listarTodos());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProdutoResponse> buscarPorId(@PathVariable Integer id) {
        return ResponseEntity.ok(produtoService.buscarPorId(id));
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_OPERADOR')")
    @PostMapping
    public ResponseEntity<ProdutoResponse> criar(@Valid @RequestBody ProdutoCreateRequest request) {
        ProdutoResponse response = produtoService.criar(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_OPERADOR')")
    @PutMapping("/{id}")
    public ResponseEntity<ProdutoResponse> atualizar(@PathVariable Integer id,
                                                     @Valid @RequestBody ProdutoUpdateRequest request) {
        ProdutoResponse response = produtoService.atualizar(id, request);
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_GERENTE')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletarSoft(@PathVariable Integer id) {
        produtoService.deletarSoft(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")  // só ADMIN pode fazer hard delete
    @DeleteMapping("/{id}/hard")
    public ResponseEntity<Void> deletarPermanente(@PathVariable Integer id) {
        produtoService.deletarPermanente(id);
        return ResponseEntity.noContent().build();
    }
}