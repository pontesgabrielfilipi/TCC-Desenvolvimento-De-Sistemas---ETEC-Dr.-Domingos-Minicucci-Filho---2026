# =============================================
# AGERP - Frontend Docker (React 18 + Vite)
# Multi-stage build: leve, rápido e pronto para produção
# =============================================

# === STAGE 1: Build ===
FROM node:22-alpine AS builder

WORKDIR /app

# Copia apenas package files primeiro (melhor cache do Docker)
COPY package*.json ./

# Instala dependências (incluindo devDependencies)
RUN npm ci --no-audit --no-fund

# Copia todo o código fonte
COPY . .

# Variaveis VITE_* sao incorporadas ao bundle durante o build, nao no runtime.
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=${VITE_API_URL}

# Build de produção do Vite
RUN npm run build

# === STAGE 2: Produção (Nginx) ===
FROM nginx:alpine AS production

# Copia os arquivos gerados pelo Vite (pasta dist)
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia configuração customizada do Nginx (SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta padrão do Nginx
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
