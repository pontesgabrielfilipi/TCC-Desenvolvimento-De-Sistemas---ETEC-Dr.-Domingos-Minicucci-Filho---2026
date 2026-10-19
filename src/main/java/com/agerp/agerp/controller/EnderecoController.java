package com.agerp.agerp.controller;

import com.agerp.agerp.dto.EnderecoCreateRequest;
import com.agerp.agerp.dto.EnderecoResponse;
import com.agerp.agerp.service.EnderecoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clientes/{clienteId}/enderecos")
public class EnderecoController {

    private final EnderecoService enderecoService;

    public EnderecoController(EnderecoService enderecoService) {
        this.enderecoService = enderecoService;
    }

    @GetMapping
    public ResponseEntity<List<EnderecoResponse>> listarPorCliente(@PathVariable Integer clienteId) {
        return ResponseEntity.ok(enderecoService.listarPorCliente(clienteId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EnderecoResponse> buscarPorId(
            @PathVariable Integer clienteId,
            @PathVariable Integer id) {
        return ResponseEntity.ok(enderecoService.buscarPorIdECliente(clienteId, id));
    }

    @PostMapping
    public ResponseEntity<EnderecoResponse> criar(
            @PathVariable Integer clienteId,
            @Valid @RequestBody EnderecoCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(enderecoService.criar(clienteId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EnderecoResponse> atualizar(
            @PathVariable Integer clienteId,
            @PathVariable Integer id,
            @Valid @RequestBody EnderecoCreateRequest request) {
        return ResponseEntity.ok(enderecoService.atualizar(clienteId, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(
            @PathVariable Integer clienteId,
            @PathVariable Integer id) {
        enderecoService.deletar(clienteId, id);
        return ResponseEntity.noContent().build();
    }
}
