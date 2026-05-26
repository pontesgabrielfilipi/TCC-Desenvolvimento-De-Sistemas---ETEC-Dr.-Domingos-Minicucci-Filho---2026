package com.agerp.agerp.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "previsao_entrega", schema = "agerp")
public class PrevisaoEntrega {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_previsao", nullable = false)
    private Integer id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_entrega", nullable = false, unique = true)
    private Entrega idEntrega;

    @Column(name = "data_calculo")
    private Instant dataCalculo;

    @Column(name = "distancia", precision = 10, scale = 2)
    private BigDecimal distancia;

    @Size(max = 100)
    @Column(name = "transito_estimado", length = 100)
    private String transitoEstimado;

    @Size(max = 100)
    @Column(name = "clima", length = 100)
    private String clima;

    @Column(name = "tempo_previsto_min")
    private Integer tempoPrevistoMin;

    @Size(max = 50)
    @Column(name = "modelo_versao", length = 50)
    private String modeloVersao;

    @Column(name = "price", precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "freight_value", precision = 10, scale = 2)
    private BigDecimal freightValue;

    // Campos de endereço do cliente e vendedor
    @Size(max = 150)
    @Column(name = "customer_city", length = 150)
    private String customerCity;

    @Size(max = 2)
    @Column(name = "customer_state", length = 2)
    private String customerState;

    @Size(max = 11)
    @Column(name = "customer_cep", length = 11)
    private String customerCep;

    @Size(max = 150)
    @Column(name = "seller_city", length = 150)
    private String sellerCity;

    @Size(max = 2)
    @Column(name = "seller_state", length = 2)
    private String sellerState;

    @Size(max = 11)
    @Column(name = "seller_cep", length = 11)
    private String sellerCep;

    @Size(max = 100)
    @Column(name = "product_category_name", length = 100)
    private String productCategoryName;

    @Column(name = "product_weight_g", precision = 10, scale = 2)
    private BigDecimal productWeightG;

    @Column(name = "product_length_cm", precision = 10, scale = 2)
    private BigDecimal productLengthCm;

    @Column(name = "product_height_cm", precision = 10, scale = 2)
    private BigDecimal productHeightCm;

    @Column(name = "product_width_cm", precision = 10, scale = 2)
    private BigDecimal productWidthCm;

    @Column(name = "order_weekday")
    private Integer orderWeekday;

    @Column(name = "order_month")
    private Integer orderMonth;

    @Column(name = "order_hour")
    private Integer orderHour;

    @Column(name = "prazo_entrega_dias")
    private Integer prazoEntregaDias;
}