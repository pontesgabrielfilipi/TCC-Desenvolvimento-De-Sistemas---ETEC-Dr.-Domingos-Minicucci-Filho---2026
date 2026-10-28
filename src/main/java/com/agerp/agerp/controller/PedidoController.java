// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.controller;

import com.agerp.agerp.dto.PedidoCreateRequest;
import com.agerp.agerp.dto.PedidoResponse;
import com.agerp.agerp.dto.PedidoUpdateRequest;
import com.agerp.agerp.dto.PrevisaoEntregaResponse;
import com.agerp.agerp.service.IaPrevisaoService;
import com.agerp.agerp.service.PedidoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pedidos")
public class PedidoController {

    private final PedidoService pedidoService;
    private final IaPrevisaoService iaPrevisaoService;

    public PedidoController(PedidoService pedidoService, IaPrevisaoService iaPrevisaoService) {
        this.pedidoService = pedidoService;
        this.iaPrevisaoService = iaPrevisaoService;
    }


    @GetMapping
    public ResponseEntity<List<PedidoResponse>> listarTodos(
            @RequestParam(defaultValue = "false") boolean refresh) {
        return ResponseEntity.ok(refresh ? pedidoService.recarregarTodos() : pedidoService.listarTodos());
    }

    @GetMapping("/paginado")
    public ResponseEntity<Page<PedidoResponse>> listarTodosPaginado(
            @PageableDefault(size = 20, sort = "dataPedido", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(pedidoService.listarTodos(pageable));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<PedidoResponse>> listarPorStatus(@PathVariable String status) {
        return ResponseEntity.ok(pedidoService.listarPorStatus(status));
    }

    @GetMapping("/status/{status}/paginado")
    public ResponseEntity<Page<PedidoResponse>> listarPorStatusPaginado(
            @PathVariable String status,
            @PageableDefault(size = 20, sort = "dataPedido", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(pedidoService.listarPorStatus(status, pageable));
    }

    @GetMapping("/cliente/{idCliente}")
    public ResponseEntity<List<PedidoResponse>> listarPorCliente(@PathVariable Integer idCliente) {
        return ResponseEntity.ok(pedidoService.listarPorCliente(idCliente));
    }

    @GetMapping("/cliente/{idCliente}/paginado")
    public ResponseEntity<Page<PedidoResponse>> listarPorClientePaginado(
            @PathVariable Integer idCliente,
            @PageableDefault(size = 20, sort = "dataPedido", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(pedidoService.listarPorCliente(idCliente, pageable));
    }


    @GetMapping("/{id}")
    public ResponseEntity<PedidoResponse> buscarPorId(@PathVariable Integer id) {
        return ResponseEntity.ok(pedidoService.buscarPorId(id));
    }


    @GetMapping("/{id}/previsao-entrega")
    public ResponseEntity<PrevisaoEntregaResponse> obterPrevisaoEntrega(@PathVariable Integer id) {
        return ResponseEntity.ok(iaPrevisaoService.obterOuCalcularPrevisao(id));
    }


    @PreAuthorize("hasAuthority('PAGE_PEDIDOS')")
    @PostMapping
    public ResponseEntity<PedidoResponse> criar(@Valid @RequestBody PedidoCreateRequest request) {
        PedidoResponse response = pedidoService.criar(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }


    @PreAuthorize("hasAuthority('PAGE_PEDIDOS')")
    @PutMapping("/{id}")
    public ResponseEntity<PedidoResponse> atualizar(@PathVariable Integer id,
                                                    @Valid @RequestBody PedidoUpdateRequest request) {
        PedidoResponse response = pedidoService.atualizar(id, request);
        return ResponseEntity.ok(response);
    }


    @PreAuthorize("hasAuthority('PAGE_PEDIDOS') and @cargoAutorizacao.podeAlterarStatusPedido(authentication, #status)")
    @PatchMapping("/{id}/status")
    public ResponseEntity<PedidoResponse> mudarStatus(@PathVariable Integer id,
                                                      @RequestParam String status) {
        PedidoResponse response = pedidoService.mudarStatus(id, status);
        return ResponseEntity.ok(response);
    }


    @PreAuthorize("hasAuthority('PAGE_PEDIDOS') and @cargoAutorizacao.nivelMinimo(authentication, 60)")
    @PostMapping("/{id}/cancelar")
    public ResponseEntity<PedidoResponse> cancelar(@PathVariable Integer id) {
        PedidoResponse response = pedidoService.cancelar(id);
        return ResponseEntity.ok(response);
    }


    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletarSoft(@PathVariable Integer id) {
        pedidoService.deletarSoft(id);
        return ResponseEntity.noContent().build();
    }
}
