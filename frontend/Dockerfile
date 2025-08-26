FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm i
COPY . .
EXPOSE 5173 24678
# Vite must listen on 0.0.0.0 inside containers
CMD ["npm","run","dev","--","--host","0.0.0.0"]
