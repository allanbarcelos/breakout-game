# Etapa 1: build do Node.js
FROM node:22-alpine AS build

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite-dev

# Copiar package.json e instalar dependências de produção
COPY api/package*.json ./
RUN npm install --production

COPY api/ ./

# Etapa 2: preparar Nginx e Node.js no container final
FROM nginx:alpine

# Instalar Node.js, npm, dependências de build e pm2
RUN apk add --no-cache nodejs npm python3 make g++ sqlite-dev \
    && npm install -g pm2

# Copiar frontend
COPY index.html /usr/share/nginx/html/
COPY static /usr/share/nginx/html/static/
COPY bricks.ico /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar backend do estágio build
COPY --from=build /app /app

WORKDIR /app

# Recompilar módulos nativos
RUN npm rebuild

EXPOSE 80

# CMD usando PM2 para rodar o backend e Nginx
CMD sh -c "nginx && pm2-runtime start server.js --no-daemon"
