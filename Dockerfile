# Etapa de build: instala TODAS las dependencias (incl. devDependencies,
# necesarias para compilar con @nestjs/cli) y compila TS -> dist/.
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Etapa final: solo dependencias de producción + el dist ya compilado.
# Así la imagen que se despliega no arrastra el compilador ni devDeps.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
