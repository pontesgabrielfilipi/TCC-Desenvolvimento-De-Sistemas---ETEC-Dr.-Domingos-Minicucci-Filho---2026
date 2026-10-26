package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Perfil;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PerfilRepository extends JpaRepository<Perfil, Integer> {

    Optional<Perfil> findByNome(String nome);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Perfil p WHERE p.nome = 'ADMIN'")
    Optional<Perfil> findAdminForUpdate();
    boolean existsByNomeIgnoreCase(String nome);
}
