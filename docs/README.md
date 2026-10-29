<!--
Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.
-->

# Documentação do AGERP

Esta pasta reúne a documentação técnica e acadêmica do projeto **AGERP - Sistema ERP com Módulo de Previsão de Entrega utilizando Machine Learning**.

## Índice

### Projeto
- [Projeto](./projeto.md)
- [Arquitetura](./arquitetura.md)

### Desenvolvimento
- [Backend](./backend.md)
- [Frontend](./frontend.md)
- [Banco de Dados](./banco-de-dados.md)
- [Autenticação](./autenticacao.md)
- [Configuração por ambiente](./configuracao-ambientes.md)
- [Pedidos e previsões de entrega](./pedidos.md)
- [Relatórios administrativos e exportação XLSX](./relatorios.md)
- [Auditoria de operações de negócio](./auditoria-negocio.md)
- [Docker](./docker.md)

### Gestão técnica
- [Decisões](./decisoes.md)
- [Problemas](./problemas.md)
- [Tarefas](./tarefas.md)
- [Validação técnica de referência](./validacao-v01-p1.md)

### TCC
- [Metodologia](./tcc/metodologia.md)
- [Desenvolvimento](./tcc/desenvolvimento.md)
- [Relatório](./tcc/relatorio.md)

## Regra de manutenção

A documentação deve registrar **contexto e decisões**, não substituir o código-fonte.

- Código: repositório principal.
- Configuração atual: arquivos do projeto.
- Arquitetura e decisões: esta pasta.
- Estado das tarefas e problemas: `tarefas.md` e `problemas.md`.
- Texto acadêmico: `tcc/`.

> Sempre que houver divergência entre esta documentação e o código atual, o código/configuração efetivamente presente no repositório deve ser tratado como fonte técnica primária e esta documentação deve ser atualizada.

O [README principal](../README.md) explica a execução local e aponta para a [licença do código próprio](../LICENSE). Os relatórios de testes datados descrevem evidências históricas, não uma nova homologação de produção.
