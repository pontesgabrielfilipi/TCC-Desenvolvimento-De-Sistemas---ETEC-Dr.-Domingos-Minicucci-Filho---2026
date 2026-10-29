<!--
Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.
-->

# Problemas e Histórico Técnico

## 1. 401 Unauthorized no login

**Sintoma:** requisição de login retornando 401.

**Área:** autenticação.

**Possíveis pontos de investigação:**
- credenciais;
- carregamento do usuário;
- `PasswordEncoder`;
- configuração do endpoint;
- filtro de autenticação;
- consulta ao perfil.

**Estado:** histórico / revisar se reaparecer.

## 2. 403 Forbidden em endpoint autenticado

**Sintoma:** acesso negado após autenticação.

**Área:** Spring Security / JWT / authorities.

**Pontos de investigação:**
- JWT recebido;
- validação do token;
- criação do `Authentication`;
- authorities/roles;
- regras de autorização;
- CORS e credenciais.

**Estado:** histórico / acompanhar.

## 3. LazyInitializationException no Perfil

**Sintoma:**

```text
Could not initialize proxy [Perfil#1] - no session
```

**Área:** JPA/Hibernate.

**Causa provável:** relacionamento lazy acessado fora da sessão Hibernate.

**Soluções a considerar:**
- consulta com `join fetch`;
- `@EntityGraph`;
- ajuste consciente do fetch;
- DTO/projeção;
- garantir acesso dentro da transação.

**Estado:** problema já investigado.

## 4. Variáveis de datasource não resolvidas

**Sintoma histórico:**

```text
Driver org.postgresql.Driver claims to not accept jdbcUrl ${SPRING_DATASOURCE_URL}
```

**Área:** configuração / Docker / Spring.

**Pontos de investigação:**
- `.env`;
- `docker compose config`;
- variáveis efetivamente presentes no container;
- `SPRING_DATASOURCE_URL`;
- perfil ativo.

## 5. Divergência entre documentação e versões

**Sintoma:** documentação inicial mencionava Spring Boot 3 e React 18.

**Estado atual do repositório:**
- Spring Boot 4.1.0;
- Java 25;
- React 19.2.x;
- Vite 8.

**Ação:** sincronizar documentação acadêmica com o estado final utilizado no TCC.

## 6. Dependências do Maven

O `pom.xml` atual possui algumas dependências possivelmente redundantes ou que devem ser revisadas conforme o projeto estabilizar.

**Ação:** realizar limpeza controlada das dependências e validar com build/testes.

## 7. Integração Python

O `docker-compose.yml` possui a dependência do backend em relação ao `python-ia` comentada.

**Ação:** definir e documentar o contrato da API Python e habilitar a dependência quando a integração estiver pronta e estável.

## 8. Possível N+1 em ProdutoService

**Sintoma:** `ProdutoService` lista produtos e, durante o mapeamento para DTO, chama `estoqueRepository.findByIdProdutoId(produto.getId())` para cada produto.

**Área:** performance / JPA.

**Impacto:** listagens de produtos podem executar uma consulta adicional de estoque por produto retornado.

**Estado:** identificado durante a organização de cache. Não foi alterado nesta tarefa para evitar misturar otimização de query com a configuração de cache.

**Ação futura:** avaliar consulta com join/projeção, `EntityGraph` ou busca em lote de estoques antes do mapeamento.
