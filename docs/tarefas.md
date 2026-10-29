<!--
Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.
-->

# Tarefas

## Situação técnica observável no repositório — 28/10/2026

Há implementações de clientes, endereços, produtos, estoque, pedidos, dashboard, relatórios XLSX, autenticação e administração nas camadas Java e React. As respectivas páginas, serviços e testes constam do código; isso não significa que todas as funcionalidades tenham sido homologadas em produção.

O acompanhamento de testes e pendências recentes está registrado em [Relatórios](relatorios.md), [Docker](docker.md) e [Validação](validacao-v01-p1.md). Esses documentos descrevem execuções datadas e possuem ressalvas; resultados anteriores não são prova de uma nova rodada de testes. Continuam dependentes de verificação específica, entre outros pontos, a implantação de produção, a acessibilidade manual e as condições operacionais fora do ambiente de testes.

## Registro anterior do planejamento

Os checklists abaixo foram preservados como histórico e **não refletem integralmente o estado atual**. Itens não marcados, como o CRUD de clientes ou a instrumentação de logs, podem já ter implementação; consulte os módulos e a documentação técnica antes de planejar retrabalho.

## 🔴 Prioridades registradas anteriormente

- [ ] Sincronizar a documentação do TCC com as versões reais do projeto.
- [ ] Finalizar/validar o fluxo de autenticação JWT + HttpOnly Cookie.
- [ ] Validar autorização RBAC para ADMIN, GERENTE, OPERADOR e FINANCEIRO.
- [ ] Finalizar CRUD de Clientes no frontend.
- [ ] Validar dashboard e seus indicadores.
- [x] Finalizar integração do backend com o microsserviço Python. *(IaPrevisaoService integrado ao módulo de Pedidos)*
- [x] Validar previsão de entrega ponta a ponta. *(endpoint /api/pedidos/{id}/previsao-entrega implementado)*
- [ ] Executar testes de integração com Docker Compose.

## 🟡 Desenvolvimento

- [ ] CRUD completo de usuários.
- [ ] CRUD completo de clientes e endereços.
- [ ] Cadastro e gerenciamento de produtos.
- [ ] Controle de estoque.
- [ ] Movimentações de estoque.
- [x] Fluxo de pedidos. *(módulo de Pedidos implementado completamente: backend + frontend + testes)*
- [ ] Pagamentos.
- [ ] Entregas.
- [x] Previsões de entrega. *(integrado ao módulo de Pedidos via IaPrevisaoService)*
- [ ] Logs do sistema.
- [ ] Gráficos do dashboard.
- [x] Testes automatizados. *(PedidoServiceTest: 19 testes unitários com Mockito, BUILD SUCCESS)*

## 🟢 Base já estabelecida

- [x] Repositório GitHub criado.
- [x] Backend Spring Boot.
- [x] PostgreSQL.
- [x] Docker Compose.
- [x] Frontend React/Vite.
- [x] Estrutura de autenticação JWT.
- [x] Estrutura RBAC.
- [x] Estrutura do microsserviço Python.
- [x] Documentação inicial do projeto.
- [x] Módulo de Pedidos (backend + frontend + IA + testes + docs).

## 🚀 Produção / futuro

- [ ] Módulo financeiro completo.
- [ ] Emissão de NF-e.
- [ ] Otimização contínua do modelo preditivo.
- [ ] Novos conjuntos de dados.
- [ ] Deploy em ambiente cloud.
- [ ] Domínio próprio.
- [ ] Monitoramento e observabilidade.
- [ ] Testes de integração com Testcontainers para o módulo de Pedidos.
- [ ] Code splitting do bundle frontend (atualmente ~1MB; considerar lazy-loading de páginas).
