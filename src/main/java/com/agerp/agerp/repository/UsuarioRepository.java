package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.entity.StatusAcesso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {

    @Query("SELECT u FROM Usuario u JOIN FETCH u.idPerfil WHERE u.email = :email")
    Optional<Usuario> findByEmail(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM Usuario u JOIN FETCH u.idPerfil WHERE u.id = :id")
    Optional<Usuario> findByIdForUpdate(Integer id);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Integer id);

    // Opcional: buscar usuários ativos
    List<Usuario> findByAtivoTrue();

    long countByAtivoTrue();

    long countByStatusAcesso(StatusAcesso statusAcesso);

    @Query("SELECT p.nome, COUNT(u) FROM Usuario u JOIN u.idPerfil p GROUP BY p.nome ORDER BY COUNT(u) DESC")
    List<Object[]> contarPorPerfil();

    long countByStatusAcessoAndIdPerfilNome(StatusAcesso statusAcesso, String perfilNome);
    long countByIdPerfilId(Integer idPerfil);
}
