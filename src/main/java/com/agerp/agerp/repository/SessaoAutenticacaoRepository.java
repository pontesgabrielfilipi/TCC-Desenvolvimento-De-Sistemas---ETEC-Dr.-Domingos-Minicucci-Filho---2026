package com.agerp.agerp.repository;

import com.agerp.agerp.entity.SessaoAutenticacao;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessaoAutenticacaoRepository extends JpaRepository<SessaoAutenticacao, UUID> {
    List<SessaoAutenticacao> findByUsuarioIdOrderByCriadaEmDesc(Integer userId);
}
