FROM docker.io/node:18
WORKDIR /app/backend/
COPY ./backend/package*.json ./backend/.npmrc ./
RUN npm ci
COPY ./backend/ ./

FROM docker.io/node:18
WORKDIR /app/frontend/
COPY ./frontend/package*.json ./frontend/.npmrc ./
RUN npm ci
COPY ./frontend/ ./
RUN npm run build

FROM docker.io/ubuntu:22.04
RUN apt update
RUN apt install -y ca-certificates curl gnupg postgresql-client-14 wait-for-it
RUN mkdir -p /etc/apt/keyrings/ && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && apt update && apt install -y nodejs
RUN npm install -g concurrently
WORKDIR /app/backend/
COPY --from=0 /app/backend/ ./
WORKDIR /app/frontend/build/
COPY --from=1 /app/frontend/build/ ./
