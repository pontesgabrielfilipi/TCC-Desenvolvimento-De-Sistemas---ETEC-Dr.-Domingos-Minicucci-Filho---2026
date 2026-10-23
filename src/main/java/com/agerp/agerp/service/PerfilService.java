package com.agerp.agerp.service;

import com.agerp.agerp.dto.PerfilCreateRequest;
import com.agerp.agerp.dto.PerfilResponse;
import com.agerp.agerp.dto.PerfilSaveRequest;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.repository.PerfilRepository;
import com.agerp.agerp.repository.UsuarioRepository;
import com.agerp.agerp.security.PaginaPermissao;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class PerfilService {

    private final PerfilRepository perfilRepository;
    private UsuarioRepository usuarioRepository;

    public PerfilService(PerfilRepository perfilRepository) {
        this.perfilRepository = perfilRepository;
    }

    @Autowired
    public void setUsuarioRepository(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    private PerfilResponse toResponse(Perfil perfil) {
        return new PerfilResponse(perfil.getId(), perfil.getNome(), perfil.getDescricao(),
                perfil.getNivelAutoridade(), perfil.getProtegido(), Set.copyOf(perfil.getPaginas()), perfil.getVersao());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public PerfilResponse criarPersonalizado(PerfilSaveRequest request) {
        String nome = validarNome(request.nome());
        if (perfilRepository.existsByNomeIgnoreCase(nome)) {
            throw new IllegalArgumentException("Já existe um cargo com este nome.");
        }
        Perfil perfil = new Perfil();
        aplicar(perfil, request, nome);
        return toResponse(perfilRepository.saveAndFlush(perfil));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public PerfilResponse editar(Integer id, PerfilSaveRequest request) {
        Perfil perfil = perfilRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cargo não encontrado."));
        if ("ADMIN".equalsIgnoreCase(perfil.getNome())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cargo ADMIN não pode ser editado.");
        }
        if (request.versao() == null || !request.versao().equals(perfil.getVersao())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cargo alterado por outra sessão. Recarregue.");
        }
        String nome = validarNome(request.nome());
        if (!nome.equalsIgnoreCase(perfil.getNome()) && perfilRepository.existsByNomeIgnoreCase(nome)) {
            throw new IllegalArgumentException("Já existe um cargo com este nome.");
        }
        // OPERADOR mantém a identidade imutável (autocadastro depende dela).
        if ("OPERADOR".equalsIgnoreCase(perfil.getNome()) && !"OPERADOR".equals(nome)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "O cargo OPERADOR não pode ser renomeado.");
        }
        aplicar(perfil, request, nome);
        return toResponse(perfilRepository.saveAndFlush(perfil));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public void excluir(Integer id) {
        Perfil perfil = perfilRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cargo não encontrado."));
        if (Boolean.TRUE.equals(perfil.getProtegido()) || "ADMIN".equalsIgnoreCase(perfil.getNome())
                || "OPERADOR".equalsIgnoreCase(perfil.getNome())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cargo padrão não pode ser excluído.");
        }
        if (usuarioRepository.countByIdPerfilId(id) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cargo vinculado a usuários; reatribua-os primeiro.");
        }
        perfilRepository.delete(perfil);
    }

    private String validarNome(String nome) {
        String normalizado = nome == null ? "" : nome.trim().toUpperCase(Locale.ROOT);
        if (normalizado.isEmpty() || normalizado.length() > 100 || !normalizado.matches("[A-Z0-9_ ]+")) {
            throw new IllegalArgumentException("Nome deve ter 1 a 100 caracteres (letras, números, espaços ou _).");
        }
        if ("ADMIN".equals(normalizado) || "OPERADOR".equals(normalizado)) {
            // O nome do OPERADOR só é aceito durante sua própria edição.
            return normalizado;
        }
        return normalizado;
    }

    private void aplicar(Perfil perfil, PerfilSaveRequest request, String nome) {
        if ("ADMIN".equals(nome) || ("OPERADOR".equals(nome) && perfil.getId() == null)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cargos reservados não podem ser criados.");
        }
        if (request.nivelAutoridade() == null || request.nivelAutoridade() < 1 || request.nivelAutoridade() > 99) {
            throw new IllegalArgumentException("Nível de autoridade deve estar entre 1 e 99.");
        }
        if (request.paginas() == null) throw new IllegalArgumentException("Informe as permissões de páginas.");
        Set<String> paginas = new LinkedHashSet<>();
        for (String pagina : request.paginas()) {
            try {
                PaginaPermissao permissao = PaginaPermissao.valueOf(pagina);
                if (permissao == PaginaPermissao.ADMIN) throw new IllegalArgumentException("A área administrativa é exclusiva do ADMIN.");
                paginas.add(permissao.name());
            } catch (NullPointerException | IllegalArgumentException e) {
                throw new IllegalArgumentException("Página inválida ou reservada: " + pagina);
            }
        }
        perfil.setNome(nome);
        perfil.setDescricao(request.descricao());
        perfil.setNivelAutoridade(request.nivelAutoridade());
        perfil.getPaginas().clear();
        perfil.getPaginas().addAll(paginas);
    }

    /**
     * Compatibilidade com a entrada legada. Não contorna as regras do cadastro de cargos.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public PerfilResponse criar(PerfilCreateRequest request) {
        if (request == null) throw new IllegalArgumentException("Dados do cargo são obrigatórios.");
        return criarPersonalizado(new PerfilSaveRequest(request.getNome(), request.getDescricao(), 20,
                Set.of("DASHBOARD", "CLIENTES", "PRODUTOS", "PEDIDOS"), null));
    }

    /**
     * Lista todos os perfis
     */
    @Transactional(readOnly = true)
    public List<PerfilResponse> listarTodos() {
        return perfilRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Busca perfil por ID
     */
    @Transactional(readOnly = true)
    public PerfilResponse buscarPorId(Integer id) {
        Perfil perfil = perfilRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado com ID: " + id));

        return toResponse(perfil);
    }

    /**
     * Busca perfil por nome (útil para seed e validações)
     */
    @Transactional(readOnly = true)
    public PerfilResponse buscarPorNome(String nome) {
        Perfil perfil = perfilRepository.findByNome(nome)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado: " + nome));

        return toResponse(perfil);
    }
}
