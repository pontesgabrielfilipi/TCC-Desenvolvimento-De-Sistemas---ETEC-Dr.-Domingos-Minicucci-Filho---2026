package com.agerp.agerp.repository;

import com.agerp.agerp.entity.LogSistema;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LogSistemaRepository extends JpaRepository<LogSistema, Integer> {

    /**
     * Lista todos os logs ordenados por data/hora (mais recente primeiro)
     */
    List<LogSistema> findAllByOrderByDataHoraDesc();

    /**
     * Lista logs de um usuário específico, ordenados por data/hora
     */
    List<LogSistema> findByIdUsuarioOrderByDataHoraDesc(Integer idUsuario);
}