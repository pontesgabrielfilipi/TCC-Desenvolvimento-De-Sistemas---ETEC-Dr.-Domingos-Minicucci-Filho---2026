# Relatório do Projeto

## Resultados do modelo de Machine Learning

Modelo utilizado:

**Random Forest Regressor**

Métricas informadas para a avaliação:

- **MBE (Mean Bias Error / Erro Médio Absoluto informado):** 3,29 dias
- **MSE (Mean Squared Error):** 20,42
- **R² (Coeficiente de Determinação):** 0,49

> Atenção acadêmica: a nomenclatura "MBE / Erro Médio Absoluto" deve ser revisada antes da versão final. MBE normalmente significa *Mean Bias Error*, enquanto MAE significa *Mean Absolute Error*. A métrica deve ser descrita exatamente conforme o cálculo realizado no código do modelo.

## Avaliação geral

O AGERP foi desenvolvido como uma solução ERP voltada a Pequenas e Médias Empresas, reunindo gestão operacional e uma camada de previsão de entrega baseada em Machine Learning.

A aplicação utiliza React no frontend, Java/Spring Boot no backend, PostgreSQL para persistência e Python/FastAPI para o serviço preditivo, com os componentes organizados por Docker Compose.

## Desafios

### Autenticação

Um dos desafios foi implementar autenticação JWT com armazenamento em HttpOnly Cookie, buscando reduzir a exposição do token ao JavaScript do navegador.

### Integração Java + Python

Outro desafio foi estabelecer comunicação entre o backend principal em Java e o microsserviço Python/FastAPI responsável pelas inferências.

### Infraestrutura

A utilização de Docker e Docker Compose permite reproduzir o ambiente de desenvolvimento e facilita a integração dos diferentes serviços.

## Trabalhos futuros

- Desenvolvimento do módulo Financeiro completo.
- Emissão de Nota Fiscal Eletrônica (NF-e).
- Otimização contínua do modelo preditivo.
- Inclusão de novos conjuntos de dados.
- Melhorias de avaliação e validação do modelo.
- Deploy em ambiente cloud.
- Configuração de domínio próprio.
- Monitoramento e observabilidade em produção.

## Estado da documentação

Este documento deve ser atualizado antes da entrega final do TCC com:
- métricas finais reproduzidas a partir do código;
- screenshots da aplicação;
- resultados dos testes;
- limitações;
- versão final das tecnologias;
- resultados da integração com o microsserviço;
- conclusão final.
