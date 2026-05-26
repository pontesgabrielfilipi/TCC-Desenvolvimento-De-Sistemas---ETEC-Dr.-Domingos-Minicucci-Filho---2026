package com.agerp.agerp.controller;

import com.agerp.agerp.dto.ClienteCreateRequest;
import com.agerp.agerp.dto.ClienteResponse;
import com.agerp.agerp.service.ClienteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clientes")
@RequiredArgsConstructor
public class ClienteController {

    private final ClienteService clienteService;

    @PostMapping
    public ResponseEntity<ClienteResponse> criar(@Valid @RequestBody ClienteCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(clienteService.criar(request));
    }

    @GetMapping
    public ResponseEntity<List<ClienteResponse>> listarTodos() {
        return ResponseEntity.ok(clienteService.listarTodos());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClienteResponse> buscarPorId(@PathVariable Integer id) {
        return ResponseEntity.ok(clienteService.buscarPorId(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClienteResponse> atualizar(@PathVariable Integer id, @Valid @RequestBody ClienteCreateRequest request) {
        return ResponseEntity.ok(clienteService.atualizar(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@PathVariable Integer id) {
        clienteService.deletar(id);
        return ResponseEntity.noContent().build();
    }
}