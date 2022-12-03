FROM docker.io/node:lts
WORKDIR /app/backend/
COPY ./backend/package*.json ./backend/.npmrc ./
RUN npm ci
COPY ./backend/ ./

FROM docker.io/node:lts
WORKDIR /app/frontend/
COPY ./frontend/package*.json ./frontend/.npmrc ./
RUN npm ci
COPY ./frontend/ ./
RUN npm run build

FROM docker.io/ubuntu:latest
RUN apt update
RUN apt install -y curl wait-for-it postgresql-client-14
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && apt install -y nodejs
RUN npm install -g concurrently
WORKDIR /app/backend/
COPY --from=0 /app/backend/ ./
WORKDIR /app/frontend/build/
COPY --from=1 /app/frontend/build/ ./
