<!--
Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.
-->

# AGERP — Sistema de Gestão Empresarial

O **AGERP** é um projeto de Trabalho de Conclusão de Curso (TCC) da ETEC Dr. Domingos Minicucci Filho, em Botucatu (SP). Reúne gestão de clientes, produtos, estoque, pedidos e usuários, indicadores administrativos, auditoria e previsão de entrega com apoio de um serviço Python. O projeto continua em evolução; funcionalidades implementadas não equivalem, por si só, a homologação para produção.

## Tecnologias

| Camada | Tecnologias presentes no repositório |
| --- | --- |
| Backend | Java 25, Spring Boot 4.1.0, Spring Security, JPA/Hibernate, Flyway e Maven |
| Frontend | React 19, TypeScript 6, Vite 8, React Router, Recharts, Bootstrap e Tailwind CSS |
| Persistência | PostgreSQL 16 |
| Previsão de entrega | Python e FastAPI, integrados ao backend |
| Infraestrutura | Docker Compose e Nginx; JWT em cookie HttpOnly |

As versões de backend e frontend seguem, respectivamente, o [pom.xml](pom.xml) e o [package.json](agerp-frontend/package.json). Os detalhes de configuração estão na [documentação técnica](docs/README.md).

## Estrutura do repositório

```text
.
├── src/
│   ├── main/java/com/agerp/agerp/  # Backend Spring Boot
│   ├── main/resources/             # Configurações e migrações SQL
│   └── test/                       # Testes Java
├── agerp-frontend/                 # React/Vite e testes frontend
├── services/python-ia/             # Serviço Python de previsão
├── docker/postgres/init/           # Inicialização do banco em volume novo
├── scripts/                        # Rotinas auxiliares
├── docs/                           # Documentação técnica e acadêmica
├── docker-compose.yml
├── .env.example
└── pom.xml
```

O modelo de dados e as relações estão descritos em [Banco de Dados](docs/banco-de-dados.md), com detalhes de [Arquitetura](docs/arquitetura.md).

## Funcionalidades

- Autenticação com JWT e controle de acesso por cargos e páginas.
- Cadastro e gestão de clientes, endereços, produtos, estoque e pedidos.
- Dashboard com indicadores e estatísticas administrativas.
- Relatórios administrativos em XLSX e trilhas de auditoria.
- Integração de previsão de entrega por meio do serviço Python/FastAPI, com tratamento de indisponibilidade.

Consulte os [módulos documentados](docs/README.md) e os [registros de validação](docs/validacao-v01-p1.md) para conhecer os limites e as verificações realizadas.

## Execução local

É necessário dispor do **JDK 25**, Maven compatível, Node.js compatível com o Vite 8 e PostgreSQL configurado. As variáveis exigidas devem ser definidas para cada ambiente. Consulte [Configuração por ambiente](docs/configuracao-ambientes.md) antes de iniciar os serviços.

Na raiz do repositório, para iniciar o backend em ambiente local devidamente configurado:

```powershell
mvn spring-boot:run
```

Para o frontend, em outro terminal:

```powershell
cd agerp-frontend
npm ci
npm run dev
```

O Vite usa a porta **5173** por padrão, enquanto o backend usa a porta **8080**. Esses valores podem ser alterados por configuração. O proxy de desenvolvimento do Vite encaminha as chamadas à API conforme `agerp-frontend/vite.config.ts`.

Para executar a pilha via Docker Compose, configure primeiro o arquivo privado de variáveis com base em [`.env.example`](.env.example). As instruções e restrições operacionais estão em [Docker](docs/docker.md) e [Configuração por ambiente](docs/configuracao-ambientes.md). Não utilize comandos que removam volumes para corrigir configuração: eles podem apagar dados.

## Documentação

- [Índice técnico e acadêmico](docs/README.md)
- [Autenticação e segurança](docs/autenticacao.md)
- [Pedidos e previsão de entrega](docs/pedidos.md)
- [Relatórios XLSX](docs/relatorios.md)
- [Decisões técnicas](docs/decisoes.md)
- [Tarefas e pendências](docs/tarefas.md)

## Autoria

Projeto desenvolvido por **Gabriel Filipi Pontes** e **André Correia Gomes da Silva** no contexto do TCC de 2026.

## Licença

O código deste projeto está disponível para consulta sob licença proprietária. A reutilização depende de autorização prévia e escrita do titular, ressalvadas as permissões legais e os termos do GitHub. Consulte o arquivo [LICENSE](LICENSE).

A licença da raiz abrange apenas os materiais cujos direitos pertençam aos titulares indicados. **Componentes de terceiros mantêm suas próprias licenças.** O módulo `services/python-ia/` possui um [arquivo de licença MIT próprio](services/python-ia/LICENSE), que deve ser respeitado; a licença proprietária da raiz não revoga permissões já concedidas.

**Solicitações de autorização:** ainda não há um canal público específico confirmado para pedidos de uso do código AGERP. O contato deverá ser definido pelos titulares antes de considerar esse procedimento completo.
