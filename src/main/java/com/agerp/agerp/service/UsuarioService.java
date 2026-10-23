package com.agerp.agerp.service;

import com.agerp.agerp.dto.UsuarioCreateRequest;
import com.agerp.agerp.dto.UsuarioResponse;
import com.agerp.agerp.dto.UsuarioUpdateRequest;
import com.agerp.agerp.dto.RedefinicaoSenhaResponse;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.repository.PerfilRepository;
import com.agerp.agerp.repository.UsuarioRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.time.Duration;
import java.time.Instant;
import java.security.SecureRandom;
import java.util.stream.Collectors;
import java.util.ArrayList;
import java.util.Locale;

@Service
public class UsuarioService {

    private static final Duration VALIDADE_CREDENCIAL_TEMPORARIA = Duration.ofMinutes(30);
    private static final char[] ALFABETO_TEMPORARIO =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%".toCharArray();
    private final SecureRandom secureRandom = new SecureRandom();

    private final UsuarioRepository usuarioRepository;
    private final PerfilRepository perfilRepository;
    private final PasswordEncoder passwordEncoder;
    private final LogSistemaService logSistemaService;

    public UsuarioService(UsuarioRepository usuarioRepository, PerfilRepository perfilRepository,
            PasswordEncoder passwordEncoder, LogSistemaService logSistemaService) {
        this.usuarioRepository = usuarioRepository;
        this.perfilRepository = perfilRepository;
        this.passwordEncoder = passwordEncoder;
        this.logSistemaService = logSistemaService;
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "usuarios", allEntries = true),
            @CacheEvict(cacheNames = "usuariosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true)
    })
    @Transactional
    public UsuarioResponse criar(UsuarioCreateRequest request) {
        return criar(request, "0.0.0.0");
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "usuarios", allEntries = true),
            @CacheEvict(cacheNames = "usuariosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true)
    })
    @Transactional
    public UsuarioResponse criar(UsuarioCreateRequest request, String ip) {
        if (usuarioRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Este email já está cadastrado no sistema.");
        }

        Perfil perfil = perfilRepository.findByNome("OPERADOR")
                .orElseThrow(() -> new IllegalStateException("Perfil padrão OPERADOR não configurado."));

        Usuario usuario = new Usuario();
        usuario.setNome(request.getNome());
        usuario.setEmail(request.getEmail());
        usuario.setSenhaHash(passwordEncoder.encode(request.getSenha()));
        usuario.setIdPerfil(perfil);
        usuario.setAtivo(false);
        usuario.setStatusAcesso(StatusAcesso.PENDENTE);

        usuario = usuarioRepository.save(usuario);
        logSistemaService.registrarLog(usuario, "CRIACAO_USUARIO_" + usuario.getId(), "USUARIO", ip);
        return toResponse(usuario);
    }

    @Cacheable("usuarios")
    @Transactional(readOnly = true)
    public List<UsuarioResponse> listarTodos() {
        return usuarioRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Cacheable("usuariosAtivos")
    @Transactional(readOnly = true)
    public List<UsuarioResponse> listarAtivos() {
        return usuarioRepository.findByAtivoTrue().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Cacheable(value = "usuarioPorId", key = "#id")
    @Transactional(readOnly = true)
    public UsuarioResponse buscarPorId(Integer id) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado. ID: " + id));
        return toResponse(usuario);
    }

    @Cacheable(value = "usuarioPorEmail", key = "#email")
    @Transactional(readOnly = true)
    public UsuarioResponse buscarPorEmail(String email) {
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado com o email: " + email));
        return toResponse(usuario);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "usuarios", allEntries = true),
            @CacheEvict(cacheNames = "usuariosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "usuarioPorId", key = "#id"),
            @CacheEvict(cacheNames = "usuarioPorEmail", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true)
    })
    @Transactional
    public UsuarioResponse atualizar(Integer id, UsuarioUpdateRequest request,
            Usuario administrador, String ip) {
        validarAdministrador(administrador);
        Usuario usuario = usuarioRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado. ID: " + id));

        String nome = request.getNome().trim();
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        Perfil perfil = perfilRepository.findById(request.getIdPerfil())
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado. ID: " + request.getIdPerfil()));
        if (perfil.getNivelAutoridade() > administrador.getIdPerfil().getNivelAutoridade()) {
            throw new org.springframework.security.access.AccessDeniedException("Não é permitido atribuir um cargo superior ao seu.");
        }
        if (usuarioRepository.existsByEmailIgnoreCaseAndIdNot(email, id)) {
            throw new IllegalArgumentException("Este email já está em uso.");
        }

        boolean emailAlterado = !email.equalsIgnoreCase(usuario.getEmail());
        boolean perfilAlterado = usuario.getIdPerfil() == null
                || !perfil.getId().equals(usuario.getIdPerfil().getId());
        if (perfilAlterado && usuario.getStatusAcesso() == StatusAcesso.APROVADO
                && usuario.getIdPerfil() != null
                && "ADMIN".equalsIgnoreCase(usuario.getIdPerfil().getNome())
                && !"ADMIN".equalsIgnoreCase(perfil.getNome())) {
            protegerUltimoAdministrador(usuario);
        }
        List<String> campos = new ArrayList<>();
        if (!nome.equals(usuario.getNome())) campos.add("nome");
        if (emailAlterado) campos.add("email");
        if (perfilAlterado) campos.add("perfil");
        usuario.setNome(nome);
        usuario.setEmail(email);
        usuario.setIdPerfil(perfil);
        if (emailAlterado || perfilAlterado) {
            usuario.setCredentialVersion(proximaVersao(usuario));
        }
        usuario = usuarioRepository.save(usuario);
        if (!campos.isEmpty()) {
            logSistemaService.registrarLog(administrador,
                    "EDICAO_USUARIO_" + id + "_CAMPOS_" + String.join("_", campos).toUpperCase(Locale.ROOT),
                    "USUARIO", ip);
        }
        return toResponse(usuario);
    }

    private UsuarioResponse toResponse(Usuario usuario) {
        return new UsuarioResponse(
                usuario.getId(),
                usuario.getNome(),
                usuario.getEmail(),
                usuario.getIdPerfil() != null ? usuario.getIdPerfil().getNome() : null,
                usuario.getAtivo(),
                usuario.getStatusAcesso().name(),
                Boolean.TRUE.equals(usuario.getTrocaSenhaObrigatoria()),
                usuario.getIdPerfil() != null ? usuario.getIdPerfil().getId() : null,
                usuario.getDataCriacao()
        );
    }

    @CacheEvict(cacheNames = "usuarios", allEntries = true, beforeInvocation = true)
    @Transactional(readOnly = true)
    public List<UsuarioResponse> recarregarTodos() {
        return usuarioRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "usuarios", allEntries = true),
            @CacheEvict(cacheNames = "usuariosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "usuarioPorId", allEntries = true),
            @CacheEvict(cacheNames = "usuarioPorEmail", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true)
    })
    @Transactional
    public RedefinicaoSenhaResponse redefinirSenha(Integer alvoId, Usuario administrador, String ip) {
        validarAdministrador(administrador);
        if (administrador.getId().equals(alvoId)) {
            throw new IllegalArgumentException("Use a alteração de senha da própria conta.");
        }
        Usuario alvo = usuarioRepository.findByIdForUpdate(alvoId)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado. ID: " + alvoId));
        String temporaria = gerarCredencialTemporaria();
        Instant expiraEm = Instant.now().plus(VALIDADE_CREDENCIAL_TEMPORARIA);
        alvo.setCredencialTemporariaHash(passwordEncoder.encode(temporaria));
        alvo.setCredencialTemporariaExpiraEm(expiraEm);
        alvo.setCredencialTemporariaUsadaEm(null);
        alvo.setTrocaSenhaObrigatoria(true);
        alvo.setCredentialVersion(proximaVersao(alvo));
        usuarioRepository.save(alvo);
        logSistemaService.registrarLog(administrador, "REDEFINICAO_SENHA_USUARIO_" + alvoId, "USUARIO", ip);
        return new RedefinicaoSenhaResponse(temporaria, expiraEm);
    }

    @Transactional
    public Usuario consumirCredencialTemporaria(Integer usuarioId) {
        Usuario usuario = usuarioRepository.findByIdForUpdate(usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));
        if (!Boolean.TRUE.equals(usuario.getTrocaSenhaObrigatoria())
                || usuario.getCredencialTemporariaHash() == null) {
            return usuario;
        }
        if (usuario.getCredencialTemporariaUsadaEm() != null) {
            throw new IllegalStateException("Credencial temporária já utilizada.");
        }
        if (usuario.getCredencialTemporariaExpiraEm() == null
                || !usuario.getCredencialTemporariaExpiraEm().isAfter(Instant.now())) {
            throw new IllegalStateException("Credencial temporária expirada.");
        }
        usuario.setCredencialTemporariaUsadaEm(Instant.now());
        return usuarioRepository.save(usuario);
    }

    @Transactional
    public void alterarSenhaObrigatoria(Integer usuarioId, String senha, String confirmacao, String ip) {
        if (!senha.equals(confirmacao)) {
            throw new IllegalArgumentException("Senha e confirmação não coincidem.");
        }
        Usuario usuario = usuarioRepository.findByIdForUpdate(usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));
        if (!Boolean.TRUE.equals(usuario.getTrocaSenhaObrigatoria())
                || usuario.getCredencialTemporariaUsadaEm() == null) {
            throw new IllegalArgumentException("Não há troca obrigatória de senha pendente.");
        }
        usuario.setSenhaHash(passwordEncoder.encode(senha));
        usuario.setCredencialTemporariaHash(null);
        usuario.setCredencialTemporariaExpiraEm(null);
        usuario.setCredencialTemporariaUsadaEm(null);
        usuario.setTrocaSenhaObrigatoria(false);
        usuario.setCredentialVersion(proximaVersao(usuario));
        usuarioRepository.save(usuario);
        logSistemaService.registrarLog(usuario, "ALTERACAO_OBRIGATORIA_SENHA", "USUARIO", ip);
    }

    private long proximaVersao(Usuario usuario) {
        return (usuario.getCredentialVersion() == null ? 0L : usuario.getCredentialVersion()) + 1L;
    }

    private String gerarCredencialTemporaria() {
        StringBuilder senha = new StringBuilder(20);
        for (int i = 0; i < 20; i++) {
            senha.append(ALFABETO_TEMPORARIO[secureRandom.nextInt(ALFABETO_TEMPORARIO.length)]);
        }
        return senha.toString();
    }

    private void validarAdministrador(Usuario administrador) {
        if (administrador == null || administrador.getIdPerfil() == null
                || !"ADMIN".equalsIgnoreCase(administrador.getIdPerfil().getNome())
                || administrador.getStatusAcesso() != StatusAcesso.APROVADO) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Ação permitida apenas para administrador aprovado.");
        }
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "usuarios", allEntries = true),
            @CacheEvict(cacheNames = "usuariosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "usuarioPorId", allEntries = true),
            @CacheEvict(cacheNames = "usuarioPorEmail", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true)
    })
    @Transactional
    public UsuarioResponse alterarStatus(Integer alvoId, StatusAcesso novoStatus, Usuario administrador, String ip) {
        if (administrador == null || administrador.getIdPerfil() == null
                || !"ADMIN".equalsIgnoreCase(administrador.getIdPerfil().getNome())
                || administrador.getStatusAcesso() != StatusAcesso.APROVADO) {
            throw new org.springframework.security.access.AccessDeniedException("Ação permitida apenas para administrador aprovado.");
        }
        if (administrador.getId().equals(alvoId)) {
            throw new IllegalArgumentException("Não é permitido alterar o próprio status de acesso.");
        }
        Usuario alvo = usuarioRepository.findById(alvoId)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado. ID: " + alvoId));
        validarTransicao(alvo, novoStatus);
        if (novoStatus != StatusAcesso.APROVADO) {
            protegerUltimoAdministrador(alvo);
        }
        alvo.setStatusAcesso(novoStatus);
        alvo.setAtivo(novoStatus == StatusAcesso.APROVADO);
        Usuario salvo = usuarioRepository.save(alvo);
        String acao = switch (novoStatus) {
            case APROVADO -> "APROVACAO_USUARIO_";
            case REJEITADO -> "REJEICAO_USUARIO_";
            case BLOQUEADO -> "BLOQUEIO_USUARIO_";
            default -> "STATUS_USUARIO_";
        };
        logSistemaService.registrarLog(administrador, acao + alvoId, "USUARIO", ip);
        return toResponse(salvo);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "usuarios", allEntries = true),
            @CacheEvict(cacheNames = "usuariosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "usuarioPorId", allEntries = true),
            @CacheEvict(cacheNames = "usuarioPorEmail", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true)
    })
    @Transactional
    public UsuarioResponse excluirLogicamente(Integer alvoId, Usuario administrador, String ip) {
        UsuarioResponse resposta = alterarStatus(alvoId, StatusAcesso.BLOQUEADO, administrador, ip);
        logSistemaService.registrarLog(administrador, "EXCLUSAO_LOGICA_USUARIO_" + alvoId,
                "USUARIO", String.valueOf(alvoId), "SUCESSO", "Usuário desativado logicamente", ip);
        return resposta;
    }

    private void validarTransicao(Usuario usuario, StatusAcesso novoStatus) {
        StatusAcesso atual = usuario.getStatusAcesso();
        boolean valida = (novoStatus == StatusAcesso.APROVADO
                && (atual == StatusAcesso.PENDENTE || atual == StatusAcesso.REJEITADO || atual == StatusAcesso.BLOQUEADO))
                || (novoStatus == StatusAcesso.REJEITADO && atual == StatusAcesso.PENDENTE)
                || (novoStatus == StatusAcesso.BLOQUEADO && atual == StatusAcesso.APROVADO);
        if (!valida) {
            throw new IllegalArgumentException("Transição de status inválida: " + atual + " para " + novoStatus + ".");
        }
    }

    private void protegerUltimoAdministrador(Usuario usuario) {
        if (usuario.getStatusAcesso() == StatusAcesso.APROVADO
                && usuario.getIdPerfil() != null
                && "ADMIN".equalsIgnoreCase(usuario.getIdPerfil().getNome())
                && usuarioRepository.countByStatusAcessoAndIdPerfilNome(StatusAcesso.APROVADO, "ADMIN") <= 1) {
            throw new IllegalArgumentException("Não é permitido bloquear o último administrador ativo.");
        }
    }

    public long countTotalUsuarios() {
        return usuarioRepository.count();
    }

    public long countUsuariosAtivos() {
        return usuarioRepository.countByAtivoTrue();
    }
}
