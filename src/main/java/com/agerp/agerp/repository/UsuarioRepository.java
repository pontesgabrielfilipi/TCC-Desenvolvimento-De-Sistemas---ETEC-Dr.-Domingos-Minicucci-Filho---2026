package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {

    @Query("SELECT u FROM Usuario u JOIN FETCH u.idPerfil WHERE u.email = :email")
    Optional<Usuario> findByEmail(String email);

    boolean existsByEmail(String email);

    // Opcional: buscar usuários ativos
    List<Usuario> findByAtivoTrue();

    long countByAtivoTrue();
}