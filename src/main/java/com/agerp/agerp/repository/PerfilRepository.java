package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Perfil;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PerfilRepository extends JpaRepository<Perfil, Integer> {

    Optional<Perfil> findByNome(String nome);
}