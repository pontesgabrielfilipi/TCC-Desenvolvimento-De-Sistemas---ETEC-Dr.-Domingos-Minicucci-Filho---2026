package com.agerp.agerp.controller;

import com.agerp.agerp.dto.DashboardRelatorioCompletoDTO;
import com.agerp.agerp.service.DashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.cache.CacheManager;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;
    private final CacheManager cacheManager;

    public DashboardController(DashboardService dashboardService, CacheManager cacheManager) {
        this.dashboardService = dashboardService;
        this.cacheManager = cacheManager;
    }

    // Endpoint principal - recomendado para o frontend
    @GetMapping("/relatorio-completo")
    public ResponseEntity<DashboardRelatorioCompletoDTO> relatorioCompleto(
            @RequestParam(defaultValue = "false") boolean refresh) {
        if (refresh && cacheManager.getCache("dashboardRelatorio") != null) {
            cacheManager.getCache("dashboardRelatorio").clear();
        }
        return ResponseEntity.ok(dashboardService.gerarRelatorioCompleto());
    }

    // Mantém compatibilidade com o que você já tinha
    @GetMapping("/estatisticas")
    public ResponseEntity<?> estatisticasBasicas() {
        return ResponseEntity.ok(dashboardService.getEstatisticasBasicas());
    }
}
