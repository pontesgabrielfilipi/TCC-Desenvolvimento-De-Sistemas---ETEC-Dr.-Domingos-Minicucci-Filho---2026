package com.agerp.agerp.repository;

import com.agerp.agerp.entity.LogSistema;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LogSistemaRepository extends JpaRepository<LogSistema, Integer>, JpaSpecificationExecutor<LogSistema> {

    @Override
    @EntityGraph(attributePaths = {"idUsuario", "idUsuario.idPerfil"})
    Page<LogSistema> findAll(Specification<LogSistema> spec, Pageable pageable);

    /**
     * Lista todos os logs ordenados por data/hora (mais recente primeiro)
     */
    List<LogSistema> findAllByOrderByDataHoraDesc();

    /**
     * Lista logs de um usuário específico, ordenados por data/hora
     */
    List<LogSistema> findByIdUsuarioOrderByDataHoraDesc(Integer idUsuario);
}
