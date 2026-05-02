FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM alpine
COPY --from=builder /app/dist /dist
CMD ["sh", "-c", "cp -r /dist/. /output/ && echo 'Frontend copied successfully'"]