package com.agerp.agerp.service;

import com.agerp.agerp.dto.PrevisaoEntregaResponse;
import com.agerp.agerp.entity.*;
import com.agerp.agerp.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class IaPrevisaoService {

    private final PedidoRepository pedidoRepository;
    private final EnderecoRepository enderecoRepository;
    private final EntregaRepository entregaRepository;
    private final PrevisaoEntregaRepository previsaoEntregaRepository;

    @Value("${AGERP_IA_URL:http://localhost:8000}")
    private String iaServiceUrl;

    @Cacheable(value = "pedidosPrevisaoIa", key = "#idPedido")
    @Transactional
    public PrevisaoEntregaResponse obterOuCalcularPrevisao(Integer idPedido) {
        Pedido pedido = pedidoRepository.findById(idPedido)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado com ID: " + idPedido));

        // 1. Obter endereço do cliente se existir
        List<Endereco> enderecos = enderecoRepository.findByIdClienteId(pedido.getIdCliente().getId());
        Endereco endereco = enderecos.isEmpty() ? null : enderecos.get(0);

        String cidadeDestino = (endereco != null && endereco.getCidade() != null) ? endereco.getCidade() : "São Paulo";
        String estadoDestino = (endereco != null && endereco.getEstado() != null) ? endereco.getEstado() : "SP";
        String cepDestino = (endereco != null && endereco.getCep() != null) ? endereco.getCep().replaceAll("[^0-9]", "") : "01000000";

        String cidadeOrigem = "Botucatu";
        String estadoOrigem = "SP";
        String cepOrigem = "18600000";

        // 2. Extrair dados físicos agregados dos itens
        BigDecimal pesoTotalG = BigDecimal.ZERO;
        BigDecimal comprimentoMax = BigDecimal.valueOf(20);
        BigDecimal alturaMax = BigDecimal.valueOf(10);
        BigDecimal larguraMax = BigDecimal.valueOf(15);
        String categoria = "utilidades_gerais";

        if (pedido.getItens() != null && !pedido.getItens().isEmpty()) {
            for (ItemPedido item : pedido.getItens()) {
                Produto prod = item.getIdProduto();
                if (prod != null) {
                    BigDecimal pesoUnitarioG = prod.getPeso() != null 
                            ? prod.getPeso().multiply(BigDecimal.valueOf(1000)) 
                            : BigDecimal.valueOf(500);
                    pesoTotalG = pesoTotalG.add(pesoUnitarioG.multiply(BigDecimal.valueOf(item.getQuantidade())));
                    if (prod.getNome() != null) {
                        categoria = normalizarCategoria(prod.getNome());
                    }
                }
            }
        }
        if (pesoTotalG.compareTo(BigDecimal.ZERO) <= 0) {
            pesoTotalG = BigDecimal.valueOf(1000);
        }

        ZonedDateTime agora = ZonedDateTime.now();
        int weekday = agora.getDayOfWeek().getValue() - 1; // 0=segunda
        int month = agora.getMonthValue();
        int hour = agora.getHour();

        int customerCepPrefix = 1000;
        int sellerCepPrefix = 18600;
        try {
            if (cepDestino.length() >= 5) {
                customerCepPrefix = Integer.parseInt(cepDestino.substring(0, 5));
            }
            if (cepOrigem.length() >= 5) {
                sellerCepPrefix = Integer.parseInt(cepOrigem.substring(0, 5));
            }
        } catch (NumberFormatException ignored) {}

        // 3. Tentar chamar a API FastAPI Python de Machine Learning
        PrevisaoEntregaResponse respostaIa = chamarMicrosservicoIa(
                pedido,
                customerCepPrefix,
                sellerCepPrefix,
                cidadeDestino,
                cidadeOrigem,
                estadoDestino,
                estadoOrigem,
                categoria,
                pesoTotalG.doubleValue(),
                comprimentoMax.doubleValue(),
                alturaMax.doubleValue(),
                larguraMax.doubleValue(),
                weekday,
                month,
                hour
        );

        // 4. Persistir ou atualizar entrega e previsão se necessário
        salvarRegistroEntregaEPrevisao(pedido, respostaIa, cidadeDestino, estadoDestino, cepDestino, cidadeOrigem, estadoOrigem, cepOrigem, pesoTotalG);

        return respostaIa;
    }

    private PrevisaoEntregaResponse chamarMicrosservicoIa(
            Pedido pedido,
            int customerCepPrefix,
            int sellerCepPrefix,
            String customerCity,
            String sellerCity,
            String customerState,
            String sellerState,
            String category,
            double weightG,
            double lengthCm,
            double heightCm,
            double widthCm,
            int weekday,
            int month,
            int hour
    ) {
        String url = iaServiceUrl.replaceAll("/+$", "") + "/predict";

        Map<String, Object> payload = new HashMap<>();
        payload.put("price", pedido.getValorTotal() != null ? pedido.getValorTotal().doubleValue() : 100.0);
        payload.put("customer_zip_code_prefix", customerCepPrefix);
        payload.put("seller_zip_code_prefix", sellerCepPrefix);
        payload.put("customer_city", customerCity.toLowerCase());
        payload.put("seller_city", sellerCity.toLowerCase());
        payload.put("product_category_name", category.toLowerCase());
        payload.put("product_weight_g", Math.max(weightG, 100.0));
        payload.put("product_length_cm", Math.max(lengthCm, 10.0));
        payload.put("product_height_cm", Math.max(heightCm, 5.0));
        payload.put("product_width_cm", Math.max(widthCm, 10.0));
        payload.put("order_weekday", weekday);
        payload.put("order_month", month);
        payload.put("order_hour", hour);

        try {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(1500);
            factory.setReadTimeout(2000);

            RestTemplate restTemplate = new RestTemplate(factory);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map body = response.getBody();
                if (body.containsKey("prazo_entrega")) {
                    Map prazo = (Map) body.get("prazo_entrega");
                    int minDias = ((Number) prazo.get("min_dias")).intValue();
                    int maxDias = ((Number) prazo.get("max_dias")).intValue();
                    double estimativa = ((Number) prazo.get("estimativa_central")).doubleValue();

                    return PrevisaoEntregaResponse.builder()
                            .idPedido(pedido.getId())
                            .prazoMinimoDias(minDias)
                            .prazoMaximoDias(maxDias)
                            .estimativaCentralDias(estimativa)
                            .status("SUCESSO")
                            .cidadeOrigem(sellerCity)
                            .estadoOrigem(sellerState)
                            .cidadeDestino(customerCity)
                            .estadoDestino(customerState)
                            .distanciaKm(BigDecimal.valueOf(180))
                            .dataCalculo(Instant.now())
                            .modeloVersao("Random Forest Regressor v6.0")
                            .mensagem("Previsão calculada com sucesso pelo modelo de Machine Learning.")
                            .build();
                }
            }
        } catch (Exception e) {
            log.warn("Microsserviço de IA Python indisponível ou erro na chamada ({}: {}). Utilizando estimativa preditiva local.",
                    url, e.getMessage());
        }

        // Fallback inteligente baseado em regras heurísticas de logística do AGERP
        int diasBase = customerState.equalsIgnoreCase(sellerState) ? 2 : 4;
        if (weightG > 5000) {
            diasBase += 1;
        }
        int minDias = Math.max(1, diasBase - 1);
        int maxDias = diasBase + 3;
        double estimativa = diasBase + 0.8;

        return PrevisaoEntregaResponse.builder()
                .idPedido(pedido.getId())
                .prazoMinimoDias(minDias)
                .prazoMaximoDias(maxDias)
                .estimativaCentralDias(estimativa)
                .status("ESTIMATIVA_HEURISTICA")
                .cidadeOrigem(sellerCity)
                .estadoOrigem(sellerState)
                .cidadeDestino(customerCity)
                .estadoDestino(customerState)
                .distanciaKm(BigDecimal.valueOf(150))
                .dataCalculo(Instant.now())
                .modeloVersao("Random Forest v6.0 (heurística)")
                .mensagem("Estimativa calculada com base na matriz logística de entrega.")
                .build();
    }

    private void salvarRegistroEntregaEPrevisao(
            Pedido pedido,
            PrevisaoEntregaResponse previsao,
            String customerCity,
            String customerState,
            String customerCep,
            String sellerCity,
            String sellerState,
            String sellerCep,
            BigDecimal pesoTotalG
    ) {
        try {
            Entrega entrega = entregaRepository.findByIdPedidoId(pedido.getId());
            if (entrega == null) {
                entrega = new Entrega();
                entrega.setIdPedido(pedido);
                entrega.setStatus("AGUARDANDO_ENVIO");
                entrega.setTempoEstimadoIa(previsao.getPrazoMaximoDias() * 24);
                entrega.setDistanciaKm(previsao.getDistanciaKm());
                entrega = entregaRepository.save(entrega);
            } else {
                entrega.setTempoEstimadoIa(previsao.getPrazoMaximoDias() * 24);
                entrega = entregaRepository.save(entrega);
            }

            PrevisaoEntrega prevEntity = previsaoEntregaRepository.findByIdEntregaId(entrega.getId());
            if (prevEntity == null) {
                prevEntity = new PrevisaoEntrega();
                prevEntity.setIdEntrega(entrega);
            }
            prevEntity.setDataCalculo(Instant.now());
            prevEntity.setDistancia(previsao.getDistanciaKm());
            prevEntity.setTransitoEstimado("NORMAL");
            prevEntity.setClima("BOM");
            prevEntity.setTempoPrevistoMin((int) (previsao.getEstimativaCentralDias() * 24 * 60));
            prevEntity.setModeloVersao(previsao.getModeloVersao());
            prevEntity.setPrice(pedido.getValorTotal());
            prevEntity.setFreightValue(BigDecimal.valueOf(25.00));
            prevEntity.setCustomerCity(customerCity);
            prevEntity.setCustomerState(customerState);
            prevEntity.setCustomerCep(customerCep);
            prevEntity.setSellerCity(sellerCity);
            prevEntity.setSellerState(sellerState);
            prevEntity.setSellerCep(sellerCep);
            prevEntity.setProductCategoryName("geral");
            prevEntity.setProductWeightG(pesoTotalG);
            prevEntity.setProductLengthCm(BigDecimal.valueOf(20));
            prevEntity.setProductHeightCm(BigDecimal.valueOf(10));
            prevEntity.setProductWidthCm(BigDecimal.valueOf(15));
            prevEntity.setOrderWeekday(ZonedDateTime.now().getDayOfWeek().getValue() - 1);
            prevEntity.setOrderMonth(ZonedDateTime.now().getMonthValue());
            prevEntity.setOrderHour(ZonedDateTime.now().getHour());
            prevEntity.setPrazoEntregaDias(previsao.getPrazoMaximoDias());

            previsaoEntregaRepository.save(prevEntity);
        } catch (Exception e) {
            log.warn("Aviso ao persistir dados de entrega/previsão: {}", e.getMessage());
        }
    }

    private String normalizarCategoria(String nome) {
        String lower = nome.toLowerCase();
        if (lower.contains("note") || lower.contains("computador") || lower.contains("eletr") || lower.contains("mouse")) {
            return "informatica_acessorios";
        }
        if (lower.contains("livro")) return "livros";
        if (lower.contains("mesa") || lower.contains("cadeira")) return "moveis_escritorio";
        return "utilidades_domesticas";
    }
}
