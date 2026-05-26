package com.agerp.agerp.controller;

import com.agerp.agerp.dto.DashboardRelatorioCompletoDTO;
import com.agerp.agerp.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    // Endpoint principal - recomendado para o frontend
    @GetMapping("/relatorio-completo")
    public ResponseEntity<DashboardRelatorioCompletoDTO> relatorioCompleto() {
        return ResponseEntity.ok(dashboardService.gerarRelatorioCompleto());
    }

    // Mantém compatibilidade com o que você já tinha
    @GetMapping("/estatisticas")
    public ResponseEntity<?> estatisticasBasicas() {
        return ResponseEntity.ok(dashboardService.getEstatisticasBasicas());
    }
}