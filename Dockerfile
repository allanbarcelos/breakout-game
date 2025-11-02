# Etapa 1: build do Node.js (instalar dependências)
FROM node:22-alpine AS build

WORKDIR /app

# Instalar dependências de build para módulos nativos
RUN apk add --no-cache python3 make g++ sqlite-dev

# Copiar arquivos de package e instalar dependências
COPY api/package*.json ./
RUN npm install --production

# Copiar o restante do backend
COPY api/ ./

# Etapa 2: preparar Nginx para servir frontend
FROM nginx:alpine

# Instalar Node.js e dependências de build no container final
RUN apk add --no-cache nodejs npm python3 make g++ sqlite-dev

# Copiar frontend (index.html, static, ícones) para a pasta do Nginx
COPY index.html /usr/share/nginx/html/
COPY static /usr/share/nginx/html/static/
COPY bricks.ico /usr/share/nginx/html/

# Copiar configuração customizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar o backend Node.js para rodar como um serviço separado
COPY --from=build /app /app

WORKDIR /app

# Recompilar módulos nativos para a arquitetura correta
RUN npm rebuild

# Expor portas
EXPOSE 80 

# Comando para rodar ambos: Nginx em background e Node.js
CMD ["sh", "-c", "nginx && node server.js"]