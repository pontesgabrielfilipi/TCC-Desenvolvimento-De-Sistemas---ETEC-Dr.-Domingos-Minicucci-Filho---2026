package com.agerp.agerp.controller;

import com.agerp.agerp.dto.PedidoCreateRequest;
import com.agerp.agerp.dto.PedidoResponse;
import com.agerp.agerp.dto.PedidoUpdateRequest;
import com.agerp.agerp.dto.PrevisaoEntregaResponse;
import com.agerp.agerp.service.IaPrevisaoService;
import com.agerp.agerp.service.PedidoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pedidos")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PedidoController {

    private final PedidoService pedidoService;
    private final IaPrevisaoService iaPrevisaoService;

    // ====================== LISTAR ======================

    @GetMapping
    public ResponseEntity<List<PedidoResponse>> listarTodos() {
        return ResponseEntity.ok(pedidoService.listarTodos());
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<PedidoResponse>> listarPorStatus(@PathVariable String status) {
        return ResponseEntity.ok(pedidoService.listarPorStatus(status));
    }

    @GetMapping("/cliente/{idCliente}")
    public ResponseEntity<List<PedidoResponse>> listarPorCliente(@PathVariable Integer idCliente) {
        return ResponseEntity.ok(pedidoService.listarPorCliente(idCliente));
    }

    // ====================== BUSCAR POR ID ======================

    @GetMapping("/{id}")
    public ResponseEntity<PedidoResponse> buscarPorId(@PathVariable Integer id) {
        return ResponseEntity.ok(pedidoService.buscarPorId(id));
    }

    // ====================== PREVISÃO DE ENTREGA VIA IA ======================

    @GetMapping("/{id}/previsao-entrega")
    public ResponseEntity<PrevisaoEntregaResponse> obterPrevisaoEntrega(@PathVariable Integer id) {
        return ResponseEntity.ok(iaPrevisaoService.obterOuCalcularPrevisao(id));
    }

    // ====================== CRIAR ======================

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_OPERADOR')")
    @PostMapping
    public ResponseEntity<PedidoResponse> criar(@Valid @RequestBody PedidoCreateRequest request) {
        PedidoResponse response = pedidoService.criar(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ====================== ATUALIZAR ======================

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_OPERADOR')")
    @PutMapping("/{id}")
    public ResponseEntity<PedidoResponse> atualizar(@PathVariable Integer id,
                                                    @Valid @RequestBody PedidoUpdateRequest request) {
        PedidoResponse response = pedidoService.atualizar(id, request);
        return ResponseEntity.ok(response);
    }

    // ====================== MUDAR STATUS ======================

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_OPERADOR')")
    @PatchMapping("/{id}/status")
    public ResponseEntity<PedidoResponse> mudarStatus(@PathVariable Integer id,
                                                      @RequestParam String status) {
        PedidoResponse response = pedidoService.mudarStatus(id, status);
        return ResponseEntity.ok(response);
    }

    // ====================== CANCELAR ======================

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_GERENTE')")
    @PostMapping("/{id}/cancelar")
    public ResponseEntity<PedidoResponse> cancelar(@PathVariable Integer id) {
        PedidoResponse response = pedidoService.cancelar(id);
        return ResponseEntity.ok(response);
    }

    // ====================== DELETAR (soft) ======================

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletarSoft(@PathVariable Integer id) {
        pedidoService.deletarSoft(id);
        return ResponseEntity.noContent().build();
    }
}
