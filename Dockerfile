# ================================
# Etapa 1: Build com Maven + JDK
# ================================
FROM maven:3.9.11-eclipse-temurin-25 AS build

WORKDIR /app

# Copia apenas pom para cache de dependências
COPY pom.xml .

RUN mvn -q -DskipTests dependency:go-offline

# Copia código fonte
COPY src ./src

# Build da aplicação
#RUN mvn -q clean package -DskipTests

# Build da aplicação (sem -q para ver o erro completo)
RUN mvn clean package -DskipTests --no-transfer-progress


# ================================
# Etapa 2: Runtime leve (JRE)
# ================================
FROM eclipse-temurin:25-jre

WORKDIR /app

# Instala wget para healthcheck
RUN sed -i 's/archive.ubuntu.com/br.archive.ubuntu.com/g' /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y wget \
    && rm -rf /var/lib/apt/lists/*
#RUN apt-get update \
#    && apt-get install -y wget \
#    && rm -rf /var/lib/apt/lists/*

# Copia o jar gerado
COPY --from=build /app/target/*.jar app.jar

# Perfil default
ENV SPRING_PROFILES_ACTIVE=dev

# Porta da aplicação
EXPOSE 8080


# ================================
# Execução da aplicação
# ================================
ENTRYPOINT ["java","-jar","app.jar"]