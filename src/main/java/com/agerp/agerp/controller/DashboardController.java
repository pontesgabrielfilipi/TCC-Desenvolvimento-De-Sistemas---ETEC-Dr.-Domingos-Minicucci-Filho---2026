// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.controller;

import com.agerp.agerp.dto.DashboardRelatorioCompletoDTO;
import com.agerp.agerp.service.DashboardService;
import com.agerp.agerp.service.EstoqueBaixoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.cache.CacheManager;
import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;
    private final CacheManager cacheManager;
    private final EstoqueBaixoService estoqueBaixoService;

    public DashboardController(DashboardService dashboardService, CacheManager cacheManager,
                               EstoqueBaixoService estoqueBaixoService) {
        this.dashboardService = dashboardService;
        this.cacheManager = cacheManager;
        this.estoqueBaixoService = estoqueBaixoService;
    }

    @GetMapping("/relatorio-completo")
    public ResponseEntity<DashboardRelatorioCompletoDTO> relatorioCompleto(
            @RequestParam(defaultValue = "false") boolean refresh) {
        if (refresh && cacheManager.getCache("dashboardRelatorio") != null) {
            cacheManager.getCache("dashboardRelatorio").clear();
        }
        return ResponseEntity.ok(dashboardService.gerarRelatorioCompleto());
    }

    @GetMapping("/estatisticas")
    public ResponseEntity<?> estatisticasBasicas() {
        return ResponseEntity.ok(dashboardService.getEstatisticasBasicas());
    }

    /** Retorna a lista completa, sem o limite visual do gráfico, para exportação XLSX. */
    @GetMapping("/estoque-baixo")
    public ResponseEntity<List<EstoqueBaixoService.ProdutoBaixo>> estoqueBaixo() {
        return ResponseEntity.ok(estoqueBaixoService.listar());
    }
}
