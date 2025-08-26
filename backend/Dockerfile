
FROM node:20

RUN apt-get update \
    && apt-get install -y --no-install-recommends gdal-bin libproj-dev binutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

# RUN ogr2ogr --version
# RUN node -e "require('ogr2ogr'); console.log('ogr2ogr npm OK')"

COPY . .
EXPOSE 3000 3000
# Vite must listen on 0.0.0.0 inside containers
CMD ["npm","run","dev","--","--host","0.0.0.0"]
