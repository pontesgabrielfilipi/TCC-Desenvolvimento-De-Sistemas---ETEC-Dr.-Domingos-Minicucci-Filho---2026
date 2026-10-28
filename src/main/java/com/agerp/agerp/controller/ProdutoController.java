// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.controller;

import com.agerp.agerp.dto.ProdutoCreateRequest;
import com.agerp.agerp.dto.ProdutoResponse;
import com.agerp.agerp.dto.ProdutoUpdateRequest;
import com.agerp.agerp.service.ProdutoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/produtos")
public class ProdutoController {

    private final ProdutoService produtoService;

    public ProdutoController(ProdutoService produtoService) {
        this.produtoService = produtoService;
    }

    @GetMapping
    public ResponseEntity<List<ProdutoResponse>> listarAtivos(
            @RequestParam(defaultValue = "false") boolean refresh) {
        return ResponseEntity.ok(refresh ? produtoService.recarregarAtivos() : produtoService.listarAtivos());
    }

    @GetMapping("/todos")
    public ResponseEntity<List<ProdutoResponse>> listarTodos() {
        return ResponseEntity.ok(produtoService.listarTodos());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProdutoResponse> buscarPorId(@PathVariable Integer id) {
        return ResponseEntity.ok(produtoService.buscarPorId(id));
    }

    @PreAuthorize("hasAuthority('PAGE_PRODUTOS')")
    @PostMapping
    public ResponseEntity<ProdutoResponse> criar(@Valid @RequestBody ProdutoCreateRequest request) {
        ProdutoResponse response = produtoService.criar(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PreAuthorize("hasAuthority('PAGE_PRODUTOS')")
    @PutMapping("/{id}")
    public ResponseEntity<ProdutoResponse> atualizar(@PathVariable Integer id,
                                                     @Valid @RequestBody ProdutoUpdateRequest request) {
        ProdutoResponse response = produtoService.atualizar(id, request);
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("hasAuthority('PAGE_PRODUTOS') and @cargoAutorizacao.nivelMinimo(authentication, 60)")
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
